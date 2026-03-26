/**
 * Emissor proprio de NF-e — Node.js puro (sem Java)
 * Usa xml-crypto para assinar XML + HTTPS para comunicar com SEFAZ
 *
 * Requisitos:
 * - Certificado Digital A1 (.pfx) base64 em NFE_CERT_BASE64
 * - Ou caminho do .pfx em NFE_CERT_PATH
 * - Senha do certificado em NFE_CERT_PASSWORD
 * - Credenciamento na SEFAZ do estado
 *
 * Custo: R$ 0/mes (so o certificado ~R$150/ano)
 */

import { db } from "../db/index.js"
import { storeFiscalConfig } from "../db/schema/fiscal-br.js"
import * as crypto from "crypto"
import * as https from "https"

// Config from env vars - read dynamically at RUNTIME (not build time)
// Using indirect access to prevent Vite/Astro from inlining env vars
const _env = process.env
function getEnv(key: string, fallback = ""): string {
  return _env[key] || fallback
}
const getNFEConfig = () => ({
  certPath: getEnv("NFE_CERT_PATH"),
  certBase64: getEnv("NFE_CERT_BASE64"),
  certPassword: getEnv("NFE_CERT_PASSWORD"),
  keyBase64: getEnv("NFE_KEY_BASE64"),
  certPemBase64: getEnv("NFE_CERT_PEM_BASE64"),
  ambiente: getEnv("NFE_AMBIENTE", "homologacao") as "homologacao" | "producao",
  uf: getEnv("NFE_UF", "SC"),
})
// Keep backward compat
const NFE_AMBIENTE = getEnv("NFE_AMBIENTE", "homologacao") as "homologacao" | "producao"
const NFE_UF = getEnv("NFE_UF", "SC")

// Store fiscal config cache
let _fiscalConfig: any = null

async function getFiscalConfig() {
  if (_fiscalConfig) return _fiscalConfig
  const rows = await db.select().from(storeFiscalConfig).limit(1)
  _fiscalConfig = rows[0] || null
  return _fiscalConfig
}

/**
 * Load certificate - supports PEM (key+cert base64) or PFX
 */
function loadCertificate(): { key: string; cert: string; certOnly: string; pfx: Buffer | null } {
  const cfg = getNFEConfig()
  // Debug: list all NFE_ env vars to diagnose
  const allNfeVars = Object.keys(_env).filter(k => k.startsWith("NFE_")).map(k => k + "=" + String(_env[k] || "").length + "chars")
  console.log("[NFe] Available env vars:", allNfeVars.join(", ") || "NONE")

  // Option 1: PEM key + cert (preferred - no format compatibility issues)
  if (cfg.keyBase64 && cfg.certPemBase64) {
    const caBase64 = getEnv("NFE_CA_BASE64")
    console.log("[NFe] Using PEM mode - key len:", cfg.keyBase64.length, "cert len:", cfg.certPemBase64.length, "ca:", caBase64 ? caBase64.length : "none")
    const key = Buffer.from(cfg.keyBase64, "base64").toString("utf-8")
    const certOnly = Buffer.from(cfg.certPemBase64, "base64").toString("utf-8")
    // For TLS: cert + CA chain. For XML signing: cert only
    let cert = certOnly
    if (caBase64) {
      cert += "\n" + Buffer.from(caBase64, "base64").toString("utf-8")
    }
    return { key, cert, certOnly, pfx: null }
  }

  // Option 2: PFX file
  console.log("[NFe] Using PFX mode (legacy) - keyBase64:", cfg.keyBase64.length, "certPem:", cfg.certPemBase64.length)
  let pfxBuffer: Buffer
  if (NFE_CERT_BASE64) {
    pfxBuffer = Buffer.from(NFE_CERT_BASE64, "base64")
  } else if (NFE_CERT_PATH) {
    const fs = require("fs")
    pfxBuffer = fs.readFileSync(NFE_CERT_PATH)
  } else {
    throw new Error("Certificado digital nao configurado. Configure NFE_KEY_BASE64+NFE_CERT_PEM_BASE64 ou NFE_CERT_BASE64.")
  }

  return { key: "", cert: "", certOnly: "", pfx: pfxBuffer }
}

/**
 * Sign XML with X509 certificate using xml-crypto
 */
async function signXml(xml: string): Promise<string> {
  try {
    const { SignedXml } = await import("xml-crypto")

    const pfxData = loadCertificate()

    // Use xml-crypto to sign - prefer PEM key, fallback to PFX
    const sigOptions: any = {
      canonicalizationAlgorithm: "http://www.w3.org/TR/2001/REC-xml-c14n-20010315",
      signatureAlgorithm: "http://www.w3.org/2000/09/xmldsig#rsa-sha1",
    }
    if (pfxData.key) {
      sigOptions.privateKey = pfxData.key
      sigOptions.publicCert = pfxData.certOnly || pfxData.cert
    } else {
      sigOptions.privateKey = pfxData.pfx
      sigOptions.passphrase = getEnv("NFE_CERT_PASSWORD")
    }
    const sig = new SignedXml(sigOptions)

    sig.addReference({
      xpath: "//*[local-name(.)='infNFe']",
      transforms: [
        "http://www.w3.org/2000/09/xmldsig#enveloped-signature",
        "http://www.w3.org/TR/2001/REC-xml-c14n-20010315",
      ],
      digestAlgorithm: "http://www.w3.org/2000/09/xmldsig#sha1",
    })

    sig.computeSignature(xml, {
      location: { reference: "//*[local-name(.)='infNFe']", action: "after" },
    })

    return sig.getSignedXml()
  } catch (err: any) {
    throw new Error("Erro ao assinar XML: " + err.message)
  }
}

/**
 * Send SOAP request to SEFAZ
 */
async function soapRequest(url: string, soapBody: string): Promise<string> {
  const pfxData = loadCertificate()

  const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <soap12:Body>${soapBody}</soap12:Body>
</soap12:Envelope>`

  return new Promise((resolve, reject) => {
    const urlObj = new URL(url)
    const options: https.RequestOptions = {
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname,
      method: "POST",
      headers: {
        "Content-Type": "application/soap+xml; charset=utf-8",
        "Content-Length": Buffer.byteLength(soapEnvelope),
      },
      ...(pfxData.key
        ? { key: pfxData.key, cert: pfxData.cert, ca: getEnv("NFE_CA_BASE64") ? Buffer.from(getEnv("NFE_CA_BASE64"), "base64").toString("utf-8") : undefined }
        : { pfx: pfxData.pfx, passphrase: getEnv("NFE_CERT_PASSWORD") }),
      rejectUnauthorized: false, // ICP-Brasil CAs not in Node default trust store
    }

    const req = https.request(options, (res) => {
      let data = ""
      res.on("data", (chunk) => (data += chunk))
      res.on("end", () => resolve(data))
    })

    req.on("error", (err) => reject(err))
    req.write(soapEnvelope)
    req.end()
  })
}

// ═══════ SEFAZ URLs ═══════

const SEFAZ_URLS: Record<string, Record<string, { homologacao: string; producao: string }>> = {
  SC: {
    autorizacao: {
      homologacao: "https://nfe-homologacao.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx",
      producao: "https://nfe.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx",
    },
    retAutorizacao: {
      homologacao: "https://nfe-homologacao.svrs.rs.gov.br/ws/NfeRetAutorizacao/NFeRetAutorizacao4.asmx",
      producao: "https://nfe.svrs.rs.gov.br/ws/NfeRetAutorizacao/NFeRetAutorizacao4.asmx",
    },
    consulta: {
      homologacao: "https://nfe-homologacao.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx",
      producao: "https://nfe.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx",
    },
    cancelamento: {
      homologacao: "https://nfe-homologacao.svrs.rs.gov.br/ws/RecepcaoEvento/RecepcaoEvento4.asmx",
      producao: "https://nfe.svrs.rs.gov.br/ws/RecepcaoEvento/RecepcaoEvento4.asmx",
    },
    statusServico: {
      homologacao: "https://nfe-homologacao.svrs.rs.gov.br/ws/NfeStatusServico/NFeStatusServico4.asmx",
      producao: "https://nfe.svrs.rs.gov.br/ws/NfeStatusServico/NFeStatusServico4.asmx",
    },
  },
}

function getSefazUrl(service: string): string {
  const uf = NFE_UF || "SC"
  const urls = SEFAZ_URLS[uf] || SEFAZ_URLS.SC
  const svc = urls[service]
  if (!svc) throw new Error(`Servico SEFAZ ${service} nao encontrado para UF ${uf}`)
  return svc[NFE_AMBIENTE]
}

// ═══════ PUBLIC FUNCTIONS ═══════

/**
 * Emitir NF-e para um pedido
 */
export async function emitirNFe(orderData: {
  numero: number
  serie: number
  cliente: {
    nome: string
    cpf?: string
    cnpj?: string
    email?: string
    telefone?: string
    endereco: {
      logradouro: string
      numero: string
      complemento?: string
      bairro: string
      cidade: string
      uf: string
      cep: string
      codigo_municipio: string
    }
  }
  itens: Array<{
    codigo: string
    descricao: string
    ncm: string
    cfop: string
    unidade: string
    quantidade: number
    valor_unitario: number
    valor_total: number
  }>
  frete: {
    modalidade: number
    valor?: number
  }
  pagamento: {
    forma: string
    valor: number
  }
}) {
  const config = await getFiscalConfig()
  if (!config) throw new Error("Configuracao fiscal nao encontrada. Configure em Fiscal Loja.")

  // Build NFe XML
  // cNF: 8-digit random numeric code (cannot be sequential or equal to nNF)
  const cNF = String(Math.floor(10000000 + Math.random() * 89999999))
  const cUF = getCodigoUF(config.uf || NFE_UF)
  // Format date in Brasilia timezone (UTC-3)
  const now = new Date()
  const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000) // UTC to BRT
  const pad = (n: number) => String(n).padStart(2, "0")
  const dhEmi = `${brt.getUTCFullYear()}-${pad(brt.getUTCMonth() + 1)}-${pad(brt.getUTCDate())}T${pad(brt.getUTCHours())}:${pad(brt.getUTCMinutes())}:${pad(brt.getUTCSeconds())}-03:00`
  const cnpjClean = (config.cnpj || "").replace(/\D/g, "")
  const aamm = dhEmi.substring(2, 4) + dhEmi.substring(5, 7)
  const serieStr = String(orderData.serie || 3).padStart(3, "0")
  const nNFStr = String(orderData.numero).padStart(9, "0")
  const tpEmis = "1"
  // Chave sem DV: UF + AAMM + CNPJ + mod + serie + nNF + tpEmis + cNF
  const chaveBase = `${cUF}${aamm}${cnpjClean}55${serieStr}${nNFStr}${tpEmis}${cNF}`
  // Calcular DV (modulo 11)
  const pesos = [2,3,4,5,6,7,8,9,2,3,4,5,6,7,8,9,2,3,4,5,6,7,8,9,2,3,4,5,6,7,8,9,2,3,4,5,6,7,8,9,2,3,4]
  let soma = 0
  const digits = chaveBase.split("").reverse()
  for (let i = 0; i < digits.length; i++) { soma += parseInt(digits[i]) * pesos[i] }
  const resto = soma % 11
  const cDV = resto < 2 ? "0" : String(11 - resto)
  const chaveAcesso = chaveBase + cDV

  const isSimples = config.regime_tributario === "simples_nacional"
  const aliqICMS = config.aliquota_icms || 0
  const aliqPIS = config.aliquota_pis || 0
  const aliqCOFINS = config.aliquota_cofins || 0
  const vProd = orderData.itens.reduce((s, i) => s + i.valor_total, 0)
  const vFrete = orderData.frete.valor || 0
  const vNF = vProd + vFrete
  const totalICMS = isSimples ? 0 : orderData.itens.reduce((s, i) => s + (i.valor_total * aliqICMS / 100), 0)
  const totalPIS = isSimples ? 0 : orderData.itens.reduce((s, i) => s + (i.valor_total * aliqPIS / 100), 0)
  const totalCOFINS = isSimples ? 0 : orderData.itens.reduce((s, i) => s + (i.valor_total * aliqCOFINS / 100), 0)

  const detXml = orderData.itens.map((item, idx) => {
    const isSimples = config.regime_tributario === "simples_nacional"
    const impostoXml = isSimples
      ? `<ICMS><ICMSSN102><orig>${config.origem_padrao || 0}</orig><CSOSN>${config.csosn_padrao || "102"}</CSOSN></ICMSSN102></ICMS>
         <PIS><PISOutr><CST>99</CST><vBC>0.00</vBC><pPIS>0.00</pPIS><vPIS>0.00</vPIS></PISOutr></PIS>
         <COFINS><COFINSOutr><CST>99</CST><vBC>0.00</vBC><pCOFINS>0.00</pCOFINS><vCOFINS>0.00</vCOFINS></COFINSOutr></COFINS>`
      : `<ICMS><ICMS00><orig>${config.origem_padrao || 0}</orig><CST>${config.cst_icms_padrao || "00"}</CST><modBC>0</modBC><vBC>${item.valor_total.toFixed(2)}</vBC><pICMS>${config.aliquota_icms || 0}</pICMS><vICMS>${((item.valor_total * (config.aliquota_icms || 0)) / 100).toFixed(2)}</vICMS></ICMS00></ICMS>
         <PIS><PISAliq><CST>${config.cst_pis_padrao || "01"}</CST><vBC>${item.valor_total.toFixed(2)}</vBC><pPIS>${config.aliquota_pis || 0}</pPIS><vPIS>${((item.valor_total * (config.aliquota_pis || 0)) / 100).toFixed(2)}</vPIS></PISAliq></PIS>
         <COFINS><COFINSAliq><CST>${config.cst_cofins_padrao || "01"}</CST><vBC>${item.valor_total.toFixed(2)}</vBC><pCOFINS>${config.aliquota_cofins || 0}</pCOFINS><vCOFINS>${((item.valor_total * (config.aliquota_cofins || 0)) / 100).toFixed(2)}</vCOFINS></COFINSAliq></COFINS>`

    return `<det nItem="${idx + 1}">
      <prod>
        <cProd>${item.codigo}</cProd><cEAN>SEM GTIN</cEAN><xProd>${item.descricao}</xProd>
        <NCM>${item.ncm || config.ncm_padrao || "97019100"}</NCM>
        <CFOP>${item.cfop}</CFOP><uCom>${item.unidade || "UN"}</uCom>
        <qCom>${item.quantidade}</qCom><vUnCom>${item.valor_unitario.toFixed(2)}</vUnCom>
        <vProd>${item.valor_total.toFixed(2)}</vProd><cEANTrib>SEM GTIN</cEANTrib>
        <uTrib>${item.unidade || "UN"}</uTrib><qTrib>${item.quantidade}</qTrib>
        <vUnTrib>${item.valor_unitario.toFixed(2)}</vUnTrib><indTot>1</indTot>
      </prod>
      <imposto>${impostoXml}</imposto>
    </det>`
  }).join("\n")

  const destDoc = orderData.cliente.cpf
    ? `<CPF>${orderData.cliente.cpf.replace(/\D/g, "")}</CPF>`
    : `<CNPJ>${(orderData.cliente.cnpj || "").replace(/\D/g, "")}</CNPJ>`

  const nfeXml = `<NFe xmlns="http://www.portalfiscal.inf.br/nfe">
  <infNFe versao="4.00" Id="NFe${chaveAcesso}">
    <ide>
      <cUF>${cUF}</cUF><cNF>${cNF}</cNF><natOp>${config.natureza_operacao || "Venda de mercadoria"}</natOp>
      <mod>55</mod><serie>${orderData.serie || config.serie_nfe || "3"}</serie><nNF>${orderData.numero}</nNF>
      <dhEmi>${dhEmi}</dhEmi><tpNF>1</tpNF>
      <idDest>${orderData.cliente.endereco.uf === (config.uf || NFE_UF) ? "1" : "2"}</idDest>
      <cMunFG>${config.codigo_municipio || "4205902"}</cMunFG>
      <tpImp>1</tpImp><tpEmis>${tpEmis}</tpEmis><cDV>${cDV}</cDV>
      <tpAmb>${NFE_AMBIENTE === "producao" ? "1" : "2"}</tpAmb>
      <finNFe>1</finNFe><indFinal>1</indFinal><indPres>1</indPres><procEmi>0</procEmi><verProc>1.0.0</verProc>
    </ide>
    <emit>
      <CNPJ>${(config.cnpj || "").replace(/\D/g, "")}</CNPJ>
      <xNome>${config.razao_social || "Empresa"}</xNome><xFant>${config.nome_fantasia || "Loja"}</xFant>
      <enderEmit>
        <xLgr>${config.logradouro || ""}</xLgr><nro>${config.numero || "S/N"}</nro>
        <xCpl>${config.complemento || ""}</xCpl><xBairro>${config.bairro || ""}</xBairro>
        <cMun>${config.codigo_municipio || ""}</cMun><xMun>${config.cidade || ""}</xMun>
        <UF>${config.uf || NFE_UF}</UF><CEP>${(config.cep || "").replace(/\D/g, "")}</CEP>
        <cPais>1058</cPais><xPais>Brasil</xPais>
      </enderEmit>
      <IE>${config.inscricao_estadual || ""}</IE>
      <CRT>${config.regime_tributario === "simples_nacional" ? "1" : config.regime_tributario === "lucro_presumido" ? "2" : "3"}</CRT>
    </emit>
    <dest>
      ${destDoc}<xNome>${getNFEConfig().ambiente === "homologacao" ? "NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL" : orderData.cliente.nome}</xNome>
      <enderDest>
        <xLgr>${orderData.cliente.endereco.logradouro}</xLgr><nro>${orderData.cliente.endereco.numero || "S/N"}</nro>
        ${orderData.cliente.endereco.complemento ? `<xCpl>${orderData.cliente.endereco.complemento}</xCpl>` : ""}
        <xBairro>${orderData.cliente.endereco.bairro || "Centro"}</xBairro>
        <cMun>${orderData.cliente.endereco.codigo_municipio || "0000000"}</cMun>
        <xMun>${orderData.cliente.endereco.cidade}</xMun><UF>${orderData.cliente.endereco.uf}</UF>
        <CEP>${(orderData.cliente.endereco.cep || "").replace(/\D/g, "")}</CEP>
        <cPais>1058</cPais><xPais>Brasil</xPais>
      </enderDest>
      <indIEDest>9</indIEDest>
      ${orderData.cliente.email ? `<email>${orderData.cliente.email}</email>` : ""}
    </dest>
    ${detXml}
    <total><ICMSTot>
      <vBC>${isSimples ? "0.00" : vProd.toFixed(2)}</vBC><vICMS>${isSimples ? "0.00" : totalICMS.toFixed(2)}</vICMS><vICMSDeson>0.00</vICMSDeson><vFCP>0.00</vFCP>
      <vBCST>0.00</vBCST><vST>0.00</vST><vFCPST>0.00</vFCPST><vFCPSTRet>0.00</vFCPSTRet>
      <vProd>${vProd.toFixed(2)}</vProd><vFrete>0.00</vFrete>
      <vSeg>0.00</vSeg><vDesc>0.00</vDesc><vII>0.00</vII><vIPI>0.00</vIPI><vIPIDevol>0.00</vIPIDevol>
      <vPIS>${isSimples ? "0.00" : totalPIS.toFixed(2)}</vPIS><vCOFINS>${isSimples ? "0.00" : totalCOFINS.toFixed(2)}</vCOFINS><vOutro>0.00</vOutro><vNF>${vProd.toFixed(2)}</vNF>
    </ICMSTot></total>
    <transp><modFrete>${orderData.frete.modalidade}</modFrete></transp>
    <pag><detPag><tPag>${orderData.pagamento.forma}</tPag><vPag>${orderData.pagamento.valor.toFixed(2)}</vPag></detPag></pag>
    ${config.info_complementar ? `<infAdic><infCpl>${config.info_complementar}</infCpl></infAdic>` : ""}
    <infRespTec>
      <CNPJ>${cnpjClean}</CNPJ>
      <xContato>Suporte Tecnico</xContato>
      <email>suporte@tessquadros.com.br</email>
      <fone>47999887766</fone>
    </infRespTec>
  </infNFe>
</NFe>`

  // Compact XML - remove whitespace between tags (SEFAZ requirement)
  const compactNfeXml = nfeXml.replace(/>\s+</g, "><").trim()

  // Sign XML
  const signedXml = await signXml(compactNfeXml)

  // Send to SEFAZ
  try {
    const url = getSefazUrl("autorizacao")
    // SEFAZ rejects whitespace between tags - must be compact XML
    const compactSignedXml = signedXml.replace(/>\s+</g, "><").trim()
    const soapBody = `<nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4"><enviNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><idLote>${Date.now()}</idLote><indSinc>1</indSinc>${compactSignedXml}</enviNFe></nfeDadosMsg>`

    const response = await soapRequest(url, soapBody)
    console.log("[NFe] SEFAZ response (first 1500):", response.substring(0, 1500))

    // Parse response - try multiple patterns
    const protMatch = response.match(/<nProt>(\d+)<\/nProt>/)
    const chaveMatch = response.match(/<chNFe>([0-9]+)<\/chNFe>/)
    const statusMatch = response.match(/<cStat>(\d+)<\/cStat>/g)
    const motivoMatch = response.match(/<xMotivo>([^<]+)<\/xMotivo>/g)

    // Get the last cStat (the one from infProt, not from cStatLote)
    const allStats = (response.match(/<cStat>(\d+)<\/cStat>/g) || []).map((m: string) => m.replace(/<\/?cStat>/g, ""))
    const allMotivos = (response.match(/<xMotivo>([^<]+)<\/xMotivo>/g) || []).map((m: string) => m.replace(/<\/?xMotivo>/g, ""))

    console.log("[NFe] cStats:", allStats.join(","), "| motivos:", allMotivos.join(" | "))

    const cStat = allStats[allStats.length - 1] || null
    const motivo = allMotivos[allMotivos.length - 1] || null
    const success = cStat === "100" || cStat === "104"

    return {
      success,
      protocolo: protMatch?.[1] || null,
      chave: chaveMatch?.[1] || null,
      status: cStat,
      motivo: motivo,
      xml: signedXml,
    }
  } catch (err: any) {
    return { success: false, error: err.message, xml: signedXml }
  }
}

/**
 * Consultar status da NF-e pela chave
 */
export async function consultarNFe(chaveNFe: string) {
  const url = getSefazUrl("consulta")
  const soapBody = `<nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeConsultaProtocolo4">
    <consSitNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
      <tpAmb>${NFE_AMBIENTE === "producao" ? "1" : "2"}</tpAmb>
      <xServ>CONSULTAR</xServ><chNFe>${chaveNFe}</chNFe>
    </consSitNFe>
  </nfeDadosMsg>`

  const response = await soapRequest(url, soapBody)
  const statusMatch = response.match(/<cStat>(\d+)<\/cStat>/)
  const motivoMatch = response.match(/<xMotivo>([^<]+)<\/xMotivo>/)
  return { cStat: statusMatch?.[1], xMotivo: motivoMatch?.[1], raw: response }
}

/**
 * Cancelar NF-e
 */
export async function cancelarNFe(chaveNFe: string, protocolo: string, justificativa: string) {
  if (justificativa.length < 15) throw new Error("Justificativa deve ter pelo menos 15 caracteres")

  const url = getSefazUrl("cancelamento")
  const config = await getFiscalConfig()
  const cnpj = (config?.cnpj || "").replace(/\D/g, "")
  const dhEvento = new Date().toISOString().replace(/\.\d{3}Z/, "-03:00")

  const eventoXml = `<envEvento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00">
    <idLote>${Date.now()}</idLote>
    <evento versao="1.00">
      <infEvento Id="ID110111${chaveNFe}01">
        <cOrgao>${chaveNFe.substring(0, 2)}</cOrgao><tpAmb>${NFE_AMBIENTE === "producao" ? "1" : "2"}</tpAmb>
        <CNPJ>${cnpj}</CNPJ><chNFe>${chaveNFe}</chNFe><dhEvento>${dhEvento}</dhEvento>
        <tpEvento>110111</tpEvento><nSeqEvento>1</nSeqEvento><verEvento>1.00</verEvento>
        <detEvento versao="1.00"><descEvento>Cancelamento</descEvento><nProt>${protocolo}</nProt><xJust>${justificativa}</xJust></detEvento>
      </infEvento>
    </evento>
  </envEvento>`

  const signedEvento = await signXml(eventoXml)
  const soapBody = `<nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4">${signedEvento}</nfeDadosMsg>`

  const response = await soapRequest(url, soapBody)
  const statusMatch = response.match(/<cStat>(\d+)<\/cStat>/)
  return { cStat: statusMatch?.[1], raw: response }
}

/**
 * Consultar status do servico SEFAZ
 */
export async function statusSefaz() {
  try {
    const url = getSefazUrl("statusServico")
    const soapBody = `<nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4">
      <consStatServ xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
        <tpAmb>${NFE_AMBIENTE === "producao" ? "1" : "2"}</tpAmb>
        <cUF>${getCodigoUF(NFE_UF)}</cUF><xServ>STATUS</xServ>
      </consStatServ>
    </nfeDadosMsg>`

    const response = await soapRequest(url, soapBody)
    const statusMatch = response.match(/<cStat>(\d+)<\/cStat>/)
    const motivoMatch = response.match(/<xMotivo>([^<]+)<\/xMotivo>/)
    return {
      online: statusMatch?.[1] === "107",
      status: statusMatch?.[1],
      motivo: motivoMatch?.[1],
      uf: NFE_UF,
    }
  } catch (err: any) {
    return { online: false, error: err.message }
  }
}

/**
 * Gerar DANFE (placeholder - DANFE requires PDF generation)
 */
export async function gerarDanfe(xmlNFe: string) {
  // DANFE generation would require a PDF lib like pdfkit
  // For now, return the XML for download
  return Buffer.from(xmlNFe).toString("base64")
}

// ═══════ HELPERS ═══════

function getCodigoUF(uf: string): string {
  const codigos: Record<string, string> = {
    AC: "12", AL: "27", AP: "16", AM: "13", BA: "29", CE: "23", DF: "53",
    ES: "32", GO: "52", MA: "21", MT: "51", MS: "50", MG: "31", PA: "15",
    PB: "25", PR: "41", PE: "26", PI: "22", RJ: "33", RN: "24", RS: "43",
    RO: "11", RR: "14", SC: "42", SP: "35", SE: "28", TO: "17",
  }
  return codigos[uf] || "42" // SC default
}
