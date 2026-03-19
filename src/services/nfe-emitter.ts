/**
 * Emissor proprio de NF-e — comunica diretamente com a SEFAZ
 * Usa a lib NFeWizard-io (open source, gratuita)
 *
 * Requisitos:
 * - Certificado Digital A1 (.pfx) em NFE_CERT_PATH
 * - Senha do certificado em NFE_CERT_PASSWORD
 * - JDK instalado no servidor
 * - Credenciamento na SEFAZ do estado
 *
 * Custo: R$ 0/mes (so o certificado ~R$150/ano)
 */

import { db } from "../db/index.js"
import { storeFiscalConfig } from "../db/schema/fiscal-br.js"

// Config from env vars
const NFE_CERT_PATH = process.env.NFE_CERT_PATH || "./certs/certificado.pfx"
const NFE_CERT_PASSWORD = process.env.NFE_CERT_PASSWORD || ""
const NFE_AMBIENTE = (process.env.NFE_AMBIENTE || "homologacao") as "homologacao" | "producao"
const NFE_UF = process.env.NFE_UF || "SP"

// Store fiscal config cache
let _fiscalConfig: any = null

async function getFiscalConfig() {
  if (_fiscalConfig) return _fiscalConfig
  const rows = await db.select().from(storeFiscalConfig).limit(1)
  _fiscalConfig = rows[0] || null
  return _fiscalConfig
}

/**
 * Inicializa o NFeWizard com o certificado digital
 */
async function initWizard() {
  try {
    // Dynamic require to avoid Vite build resolution
    const { createRequire } = await import("module")
    const require = createRequire(import.meta.url)
    const NFeWizard = require("nfewizard-io")

    const wizard = new NFeWizard({
      dfe: {
        ambiente: NFE_AMBIENTE === "producao" ? 1 : 2, // 1=producao, 2=homologacao
        UF: NFE_UF,
        versaoDF: "4.00",
        timezone: "America/Sao_Paulo",
      },
      certificado: {
        pfx: NFE_CERT_PATH,
        senha: NFE_CERT_PASSWORD,
      },
    })

    return wizard
  } catch (err: any) {
    console.error("Erro ao inicializar NFeWizard:", err.message)
    throw new Error("Emissor NFe nao configurado. Verifique certificado digital e JDK.")
  }
}

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
    modalidade: number // 0=emitente, 1=destinatario, 9=sem frete
    valor?: number
  }
  pagamento: {
    forma: string // 01=dinheiro, 03=cartao credito, 04=cartao debito, 17=pix, 15=boleto
    valor: number
  }
}) {
  const config = await getFiscalConfig()
  if (!config) throw new Error("Configuracao fiscal nao encontrada. Configure em Fiscal Loja.")

  const wizard = await initWizard()

  // Montar XML da NF-e conforme layout 4.00
  const nfe = {
    infNFe: {
      versao: "4.00",
      ide: {
        cUF: getCodigoUF(config.uf || NFE_UF),
        cNF: String(orderData.numero).padStart(8, "0"),
        natOp: config.natureza_operacao || "Venda de mercadoria",
        mod: "55", // NF-e
        serie: String(orderData.serie || config.serie_nfe || "1"),
        nNF: String(orderData.numero),
        dhEmi: new Date().toISOString(),
        tpNF: "1", // 1=saida
        idDest: orderData.cliente.endereco.uf === (config.uf || NFE_UF) ? "1" : "2", // 1=interna, 2=interestadual
        cMunFG: config.codigo_municipio || "3550308", // SP capital default
        tpImp: "1", // 1=retrato
        tpEmis: "1", // 1=normal
        tpAmb: NFE_AMBIENTE === "producao" ? "1" : "2",
        finNFe: "1", // 1=normal
        indFinal: "1", // 1=consumidor final
        indPres: "1", // 1=presencial
        procEmi: "0", // 0=aplicativo contribuinte
        verProc: "1.0.0",
      },
      emit: {
        CNPJ: (config.cnpj || "").replace(/\D/g, ""),
        xNome: config.razao_social || "Empresa",
        xFant: config.nome_fantasia || "Loja",
        IE: config.inscricao_estadual || "",
        CRT: config.regime_tributario === "simples_nacional" ? "1" : config.regime_tributario === "lucro_presumido" ? "2" : "3",
        enderEmit: {
          xLgr: config.logradouro || "",
          nro: config.numero || "S/N",
          xCpl: config.complemento || "",
          xBairro: config.bairro || "",
          cMun: config.codigo_municipio || "",
          xMun: config.cidade || "",
          UF: config.uf || NFE_UF,
          CEP: (config.cep || "").replace(/\D/g, ""),
          cPais: "1058",
          xPais: "Brasil",
          fone: "",
        },
      },
      dest: {
        ...(orderData.cliente.cpf
          ? { CPF: orderData.cliente.cpf.replace(/\D/g, "") }
          : { CNPJ: (orderData.cliente.cnpj || "").replace(/\D/g, "") }),
        xNome: orderData.cliente.nome,
        indIEDest: "9", // 9=nao contribuinte
        email: orderData.cliente.email || "",
        enderDest: {
          xLgr: orderData.cliente.endereco.logradouro,
          nro: orderData.cliente.endereco.numero,
          xCpl: orderData.cliente.endereco.complemento || "",
          xBairro: orderData.cliente.endereco.bairro,
          cMun: orderData.cliente.endereco.codigo_municipio,
          xMun: orderData.cliente.endereco.cidade,
          UF: orderData.cliente.endereco.uf,
          CEP: orderData.cliente.endereco.cep.replace(/\D/g, ""),
          cPais: "1058",
          xPais: "Brasil",
          fone: orderData.cliente.telefone || "",
        },
      },
      det: orderData.itens.map((item, idx) => ({
        nItem: String(idx + 1),
        prod: {
          cProd: item.codigo,
          cEAN: "SEM GTIN",
          xProd: item.descricao,
          NCM: item.ncm || config.ncm_padrao || "49119900",
          CFOP: item.cfop || (orderData.cliente.endereco.uf === (config.uf || NFE_UF)
            ? config.cfop_dentro_estado || "5102"
            : config.cfop_fora_estado || "6102"),
          uCom: item.unidade || config.unidade_comercial || "UN",
          qCom: String(item.quantidade),
          vUnCom: item.valor_unitario.toFixed(2),
          vProd: item.valor_total.toFixed(2),
          cEANTrib: "SEM GTIN",
          uTrib: item.unidade || config.unidade_tributavel || "UN",
          qTrib: String(item.quantidade),
          vUnTrib: item.valor_unitario.toFixed(2),
          indTot: "1", // 1=soma no total
        },
        imposto: buildImposto(config, item),
      })),
      total: {
        ICMSTot: {
          vBC: "0.00",
          vICMS: "0.00",
          vICMSDeson: "0.00",
          vFCP: "0.00",
          vBCST: "0.00",
          vST: "0.00",
          vFCPST: "0.00",
          vFCPSTRet: "0.00",
          vProd: orderData.itens.reduce((s, i) => s + i.valor_total, 0).toFixed(2),
          vFrete: (orderData.frete.valor || 0).toFixed(2),
          vSeg: "0.00",
          vDesc: "0.00",
          vII: "0.00",
          vIPI: "0.00",
          vIPIDevol: "0.00",
          vPIS: "0.00",
          vCOFINS: "0.00",
          vOutro: "0.00",
          vNF: (orderData.itens.reduce((s, i) => s + i.valor_total, 0) + (orderData.frete.valor || 0)).toFixed(2),
        },
      },
      transp: {
        modFrete: String(orderData.frete.modalidade),
      },
      pag: {
        detPag: [{
          tPag: orderData.pagamento.forma,
          vPag: orderData.pagamento.valor.toFixed(2),
        }],
      },
      infAdic: {
        infCpl: config.info_complementar || "Quadro decorativo em canvas premium.",
      },
    },
  }

  // Enviar para SEFAZ
  try {
    const resultado = await wizard.NFe_Autorizacao(nfe)
    return {
      success: true,
      protocolo: resultado?.protNFe?.infProt?.nProt || null,
      chave: resultado?.protNFe?.infProt?.chNFe || null,
      status: resultado?.protNFe?.infProt?.cStat || null,
      motivo: resultado?.protNFe?.infProt?.xMotivo || null,
      xml: resultado?.xml || null,
    }
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Erro ao emitir NF-e",
      details: err,
    }
  }
}

/**
 * Consultar status da NF-e pela chave
 */
export async function consultarNFe(chaveNFe: string) {
  const wizard = await initWizard()
  try {
    const resultado = await wizard.NFe_ConsultaProtocolo({ chNFe: chaveNFe })
    return resultado
  } catch (err: any) {
    throw new Error("Erro ao consultar NF-e: " + err.message)
  }
}

/**
 * Cancelar NF-e
 */
export async function cancelarNFe(chaveNFe: string, protocolo: string, justificativa: string) {
  if (justificativa.length < 15) throw new Error("Justificativa deve ter pelo menos 15 caracteres")

  const wizard = await initWizard()
  try {
    const resultado = await wizard.NFe_RecepcaoEvento_Cancelamento({
      chNFe: chaveNFe,
      nProt: protocolo,
      xJust: justificativa,
    })
    return resultado
  } catch (err: any) {
    throw new Error("Erro ao cancelar NF-e: " + err.message)
  }
}

/**
 * Consultar status do servico SEFAZ
 */
export async function statusSefaz() {
  const wizard = await initWizard()
  try {
    const resultado = await wizard.NFe_ConsultaStatusServico()
    return {
      online: resultado?.cStat === "107",
      status: resultado?.cStat,
      motivo: resultado?.xMotivo,
      uf: resultado?.cUF,
    }
  } catch (err: any) {
    return { online: false, error: err.message }
  }
}

/**
 * Gerar DANFE em PDF a partir do XML
 */
export async function gerarDanfe(xmlNFe: string) {
  const wizard = await initWizard()
  try {
    const pdf = await wizard.GerarDANFE(xmlNFe)
    return pdf // Base64 do PDF
  } catch (err: any) {
    throw new Error("Erro ao gerar DANFE: " + err.message)
  }
}

// ===== HELPERS =====

function getCodigoUF(uf: string): string {
  const codigos: Record<string, string> = {
    AC: "12", AL: "27", AP: "16", AM: "13", BA: "29", CE: "23", DF: "53",
    ES: "32", GO: "52", MA: "21", MT: "51", MS: "50", MG: "31", PA: "15",
    PB: "25", PR: "41", PE: "26", PI: "22", RJ: "33", RN: "24", RS: "43",
    RO: "11", RR: "14", SC: "42", SP: "35", SE: "28", TO: "17",
  }
  return codigos[uf] || "35"
}

function buildImposto(config: any, item: any) {
  const isSimples = config.regime_tributario === "simples_nacional"

  if (isSimples) {
    return {
      ICMS: {
        ICMSSN102: {
          orig: String(config.origem_padrao || 0),
          CSOSN: config.csosn_padrao || "102", // 102=sem permissao de credito
        },
      },
      PIS: {
        PISOutr: {
          CST: config.cst_pis_padrao || "99",
          vBC: "0.00",
          pPIS: "0.00",
          vPIS: "0.00",
        },
      },
      COFINS: {
        COFINSOutr: {
          CST: config.cst_cofins_padrao || "99",
          vBC: "0.00",
          pCOFINS: "0.00",
          vCOFINS: "0.00",
        },
      },
    }
  }

  // Lucro Presumido / Real
  return {
    ICMS: {
      ICMS00: {
        orig: String(config.origem_padrao || 0),
        CST: config.cst_icms_padrao || "00",
        modBC: "0",
        vBC: item.valor_total.toFixed(2),
        pICMS: String(config.aliquota_icms || 0),
        vICMS: ((item.valor_total * (config.aliquota_icms || 0)) / 100).toFixed(2),
      },
    },
    PIS: {
      PISAliq: {
        CST: config.cst_pis_padrao || "01",
        vBC: item.valor_total.toFixed(2),
        pPIS: String(config.aliquota_pis || 0),
        vPIS: ((item.valor_total * (config.aliquota_pis || 0)) / 100).toFixed(2),
      },
    },
    COFINS: {
      COFINSAliq: {
        CST: config.cst_cofins_padrao || "01",
        vBC: item.valor_total.toFixed(2),
        pCOFINS: String(config.aliquota_cofins || 0),
        vCOFINS: ((item.valor_total * (config.aliquota_cofins || 0)) / 100).toFixed(2),
      },
    },
  }
}
