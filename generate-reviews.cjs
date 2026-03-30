// Run this with: node generate-reviews.cjs
const fs = require('fs');

let seed = 42;
function rand() { seed = (seed * 16807 + 0) % 2147483647; return (seed - 1) / 2147483646; }
function randInt(min, max) { return Math.floor(rand() * (max - min + 1)) + min; }
function pick(arr) { return arr[randInt(0, arr.length - 1)]; }

const firstNames = ["Maria","Ana","Juliana","Fernanda","Camila","Bruna","Patrícia","Luciana","Amanda","Carolina","Renata","Tatiane","Daniela","Aline","Vanessa","Priscila","Gabriela","Letícia","Mariana","Raquel","Larissa","Bianca","Natália","Cláudia","Adriana","Sabrina","Thais","Michele","Jéssica","Cristina","Simone","Sandra","Elaine","Viviane","Rosana","Débora","Karine","Márcia","Luana","Rafaela","João","Carlos","Pedro","Lucas","Rafael","Bruno","Marcos","André","Fernando","Ricardo","Gustavo","Eduardo","Paulo","Roberto","Rodrigo","Marcelo","Felipe","Leonardo","Diego","Thiago","Matheus","Gabriel","Daniel","Alexandre","Fábio","Leandro","Renan","Vinícius","Henrique","Caio","Igor","Sérgio","Júlio","Antônio","José","Márcio","Rogério","Wagner","Emerson","Luís","Beatriz","Helena","Isabela","Vitória","Clara","Laura","Sofia","Alice","Heloísa","Manuela","Valentina","Lívia","Cecília","Lorena","Marina","Isadora","Pietra","Laís","Milena","Stella"];
const lastInitials = "A B C D E F G H I J K L M N O P Q R S T U V W X Y Z".split(" ");
const cities = [
  {city:"São Paulo",state:"SP"},{city:"Rio de Janeiro",state:"RJ"},{city:"Belo Horizonte",state:"MG"},{city:"Curitiba",state:"PR"},{city:"Porto Alegre",state:"RS"},{city:"Florianópolis",state:"SC"},{city:"Salvador",state:"BA"},{city:"Fortaleza",state:"CE"},{city:"Recife",state:"PE"},{city:"Brasília",state:"DF"},{city:"Goiânia",state:"GO"},{city:"Manaus",state:"AM"},{city:"Campinas",state:"SP"},{city:"São Bernardo do Campo",state:"SP"},{city:"Guarulhos",state:"SP"},{city:"Osasco",state:"SP"},{city:"Santo André",state:"SP"},{city:"Sorocaba",state:"SP"},{city:"Ribeirão Preto",state:"SP"},{city:"São José dos Campos",state:"SP"},{city:"Niterói",state:"RJ"},{city:"Petrópolis",state:"RJ"},{city:"Volta Redonda",state:"RJ"},{city:"Joinville",state:"SC"},{city:"Blumenau",state:"SC"},{city:"Balneário Camboriú",state:"SC"},{city:"Londrina",state:"PR"},{city:"Maringá",state:"PR"},{city:"Cascavel",state:"PR"},{city:"Uberlândia",state:"MG"},{city:"Juiz de Fora",state:"MG"},{city:"Contagem",state:"MG"},{city:"Caxias do Sul",state:"RS"},{city:"Pelotas",state:"RS"},{city:"Canoas",state:"RS"},{city:"Natal",state:"RN"},{city:"João Pessoa",state:"PB"},{city:"Maceió",state:"AL"},{city:"Aracaju",state:"SE"},{city:"Teresina",state:"PI"},{city:"São Luís",state:"MA"},{city:"Belém",state:"PA"},{city:"Campo Grande",state:"MS"},{city:"Cuiabá",state:"MT"},{city:"Vitória",state:"ES"},{city:"Vila Velha",state:"ES"},{city:"Santos",state:"SP"},{city:"Piracicaba",state:"SP"},{city:"Jundiaí",state:"SP"},{city:"Bauru",state:"SP"},{city:"Franca",state:"SP"},{city:"Taubaté",state:"SP"},{city:"Limeira",state:"SP"},{city:"São José do Rio Preto",state:"SP"},{city:"Chapecó",state:"SC"},{city:"Ponta Grossa",state:"PR"},{city:"Foz do Iguaçu",state:"PR"},{city:"Novo Hamburgo",state:"RS"},{city:"Santa Maria",state:"RS"},{city:"Feira de Santana",state:"BA"},{city:"Camaçari",state:"BA"},{city:"Lauro de Freitas",state:"BA"}
];

function getRating() {
  const r = rand();
  if (r < 0.60) return 5;
  if (r < 0.85) return 4;
  if (r < 0.95) return 3;
  if (r < 0.98) return 2;
  return 1;
}

function getDate() {
  const start = new Date('2025-06-01').getTime();
  const end = new Date('2026-03-25').getTime();
  const d = new Date(start + rand() * (end - start));
  return d.toISOString().split('T')[0];
}

const titles5 = ["Amei o quadro!","Perfeito para minha sala","Superou minhas expectativas","Qualidade incrível","Melhor compra que fiz","Recomendo demais!","Lindo demais!","Presente perfeito","Excelente qualidade","Cores vibrantes","Ficou maravilhoso na parede","Muito satisfeita!","Entrega rápida e produto top","Impressionante!","Adorei o acabamento","Produto premium","Valeu cada centavo","Decoração perfeita","Show de bola!","Nota 10!","Simplesmente perfeito","Amei, vou comprar mais","Surpreendeu positivamente","Muito bonito","Transformou meu ambiente","Quadro lindo!","Qualidade excepcional","Ótima compra","Recomendo a todos","Maravilhoso!","Encantada com o produto","Top demais!","Produto de primeira","Muito bem feito","Fiquei encantada","Superou tudo","Chegou perfeito","Exatamente como na foto","Melhor que o esperado","Decoração impecável"];
const titles4 = ["Bom produto","Gostei bastante","Bonito, mas poderia ser melhor","Bom custo-benefício","Atendeu expectativas","Boa qualidade","Recomendo","Gostei do resultado","Produto bom","Quase perfeito","Bom acabamento","Satisfeita no geral","Entrega ok, produto bom","Bonito demais","Valeu a pena","Bom quadro","Ficou legal","Bem feito","Gostei muito","Boa compra"];
const titles3 = ["Razoável","Poderia ser melhor","Mais ou menos","Esperava mais","Mediano","Regular","Não é ruim mas...","Deu pro gasto","Ok, nada demais","Produto aceitável","Tem pontos a melhorar","Razoável pelo preço"];
const titles2 = ["Decepcionante","Não gostei muito","Qualidade inferior","Esperava muito mais","Produto fraco","Abaixo do esperado","Não recomendo","Deixou a desejar"];
const titles1 = ["Péssimo","Horrível","Não comprem","Produto terrível","Muito ruim","Jogou dinheiro fora","Arrependida","Fraude total"];

const comments5 = [
  () => `Comprei para ${pick(["minha sala","meu quarto","o escritório","a sala de estar","meu home office","o quarto do casal"])} e ficou ${pick(["perfeito","maravilhoso","incrível","lindo","sensacional"])}! ${pick(["As cores são vibrantes e o acabamento é impecável.","A qualidade do canvas é excelente, muito superior ao que eu esperava.","Todos que visitam elogiam.","Minha esposa amou!","Recomendo muito.","Entrega super rápida e bem embalado.","Chegou antes do prazo."])}`,
  () => `${pick(["Quadro","Tela","Canvas","Produto"])} de ${pick(["excelente","ótima","altíssima","primeira"])} qualidade. ${pick(["A impressão é nítida e as cores são fiéis à foto do anúncio.","Acabamento perfeito, sem nenhum defeito.","Material resistente e bem acabado.","Superou todas as minhas expectativas.","Veio muito bem embalado e protegido."])}`,
  () => `Presenteei ${pick(["minha mãe","minha esposa","meu marido","minha sogra","uma amiga","minha irmã"])} ${pick(["no aniversário","no Natal","no Dia das Mães","de casamento novo","de presente"])} e ${pick(["ela adorou","ele amou","ficou encantada","foi um sucesso","chorou de emoção","não parava de elogiar"])}! ${pick(["O quadro é realmente lindo.","Qualidade top.","Já quero comprar outro.","Vou comprar mais para mim agora.","Recomendo demais!"])}`,
  () => `${pick(["Entrega super rápida!","Chegou em 3 dias!","Veio antes do prazo!","Frete rápido!","Entrega no prazo certinho!"])} ${pick(["O produto veio muito bem embalado, sem nenhum amassado.","Embalagem excelente, chegou intacto.","Bem protegido na embalagem."])} ${pick(["A qualidade é top!","Ficou perfeito na minha parede.","Amei o resultado final.","Nota 10!"])}`,
  () => `Já é ${pick(["o segundo","o terceiro","o quarto","mais um"])} quadro que compro ${pick(["nessa loja","aqui","deles"])} e a qualidade ${pick(["é sempre excelente","nunca decepciona","é sempre a mesma: perfeita","continua impecável"])}. ${pick(["Já virei cliente fiel.","Recomendo de olhos fechados.","Melhor custo-benefício do mercado.","Sempre entrega rápida e produto perfeito."])}`,
  () => `As ${pick(["cores","tonalidades","nuances"])} do quadro são ${pick(["vibrantes","lindas","perfeitas","fiéis à foto","incríveis"])}. ${pick(["O canvas tem uma textura premium que dá um toque especial.","Material de alta qualidade, nota-se de longe.","Impressão de altíssima resolução.","Acabamento impecável em cada detalhe."])} ${pick(["Amei!","Super recomendo!","Nota mil!","Perfeito!",""])}`,
  () => `${pick(["Transformou","Mudou completamente","Deu vida a","Renovou"])} ${pick(["minha sala de estar","meu quarto","meu escritório","o ambiente","a parede da sala"])}. ${pick(["Todos os visitantes perguntam onde comprei.","O ambiente ficou muito mais aconchegante.","Deu um toque sofisticado ao ambiente.","A decoração ficou completa."])}`,
  () => `Produto ${pick(["excelente","maravilhoso","fantástico","de primeira"])}! ${pick(["O acabamento é de altíssima qualidade.","As cores são exatamente como nas fotos.","A tela tem uma textura muito bonita.","O tamanho é ideal."])} ${pick(["Comprarei mais com certeza.","Já estou escolhendo o próximo.","Recomendo sem pensar duas vezes.","Melhor loja de quadros que já comprei.",""])}`,
  () => `${pick(["Fiquei muito feliz","Estou muito satisfeita","Adorei tudo","Amei demais"])} com ${pick(["a compra","o produto","o resultado","a qualidade"])}. ${pick(["Chegou rápido, bem embalado e exatamente como eu imaginava.","O quadro é ainda mais bonito pessoalmente do que na foto.","Superou minhas expectativas em todos os aspectos."])}`,
  () => `Que ${pick(["lindo","maravilhoso","incrível","espetacular"])}! ${pick(["Coloquei na parede da sala e ficou um charme.","Meu cantinho de leitura ficou perfeito.","O quarto ganhou outra cara.","Meu home office agora tem personalidade."])} ${pick(["Qualidade nota 10.","Amei a qualidade do material.","Excelente custo-benefício.","Já quero comprar o conjunto todo!",""])}`,
  () => `${pick(["Comprei meio desconfiada","Tinha medo de comprar online","Não esperava muito","Estava com pé atrás"])} mas ${pick(["me surpreendi demais!","superou todas expectativas!","fiquei encantada!","amei de verdade!","não me arrependi nem um pouco!"])} ${pick(["O quadro é lindo e de excelente qualidade.","Produto fiel às fotos e com ótimo acabamento.","A qualidade é muito superior ao preço pago."])}`,
  () => `${pick(["Perfeito!","Show!","Maravilha!","Sensacional!"])} ${pick(["Coloquei no quarto do meu filho e ele adorou.","Ficou lindo na varanda gourmet.","Combinação perfeita com minha decoração.","Deu um upgrade na decoração do apartamento."])} ${pick(["Produto premium a um preço justo.","Entrega dentro do prazo.","Tudo perfeito do início ao fim.","Nota máxima!",""])}`,
];
const comments4 = [
  () => `${pick(["Gostei bastante do quadro.","Produto bonito e bem acabado.","Bom produto no geral.","Atendeu minhas expectativas."])} ${pick(["A qualidade é boa, mas achei que poderia ter vindo com moldura mais reforçada.","Cores bonitas, só achei um pouquinho diferente da foto do site.","Entrega demorou um pouco mais do que o esperado, mas o produto compensou.","Único ponto é que o gancho para pendurar poderia ser melhor.","Material bom, porém o acabamento nas bordas poderia ser mais caprichado."])}`,
  () => `${pick(["Bonito quadro,","Boa compra,","Produto legal,","Tela bonita,"])} ${pick(["ficou muito bem na minha sala.","minha esposa gostou muito.","decorou bem o escritório.","combinou com a decoração."])} ${pick(["Tirando a demora na entrega, tudo certo.","Só acho que poderia ter uma opção maior.","O preço é um pouco salgado mas vale.","Embalagem poderia proteger mais.",""])}`,
  () => `${pick(["A qualidade do canvas é boa.","Material de boa qualidade.","Impressão com boa resolução.","Acabamento satisfatório."])} ${pick(["As cores ficaram um tom mais escuro que na foto do site, mas ainda assim bonito.","Chegou bem embalado, sem nenhum defeito.","O tamanho é bom para o que eu precisava.","A tela tem uma boa textura."])} ${pick(["Recomendo.","Bom custo-benefício.","Compraria novamente.",""])}`,
  () => `Comprei ${pick(["para dar de presente","para o meu apartamento novo","para redecorar a sala","para o quarto"])} e ${pick(["gostei do resultado","ficou legal","a pessoa adorou","ficou bonito"])}. ${pick(["Só desconto uma estrela pela demora na entrega.","Única ressalva é que veio sem as instruções de instalação.","Poderia ter uma variedade maior de tamanhos.","O frete foi um pouco caro."])}`,
  () => `${pick(["Quadro bonito e bem feito.","Tela de boa qualidade.","Produto bom.","Canvas com boa impressão."])} ${pick(["Ficou ótimo no meu home office.","Combinou perfeitamente com o sofá novo.","A parede da sala ficou mais bonita."])} ${pick(["Daria 5 estrelas se a entrega fosse mais rápida.","Tirando o prazo de entrega, perfeito.","Só faltou vir com os parafusos para fixação.",""])}`,
];
const comments3 = [
  () => `${pick(["O produto é ok,","O quadro é razoável,","Não é ruim,","Produto mediano,"])} ${pick(["mas as cores ficaram bem diferentes do que aparece no site.","mas o acabamento nas bordas deixou a desejar.","mas achei o material meio fino demais.","mas esperava mais pela qualidade descrita."])} ${pick(["Pelo preço, acho que dava para ser melhor.","Não sei se compraria de novo.","Poderia melhorar bastante.","Deu pro gasto."])}`,
  () => `${pick(["Demorou","Levou","A entrega demorou"])} ${pick(["quase um mês para chegar","muito mais que o previsto","20 dias além do prazo","bastante para chegar"])}. ${pick(["O produto em si até é bonito, mas a experiência de compra foi ruim.","Quando chegou, até gostei, mas o prazo comprometeu.","O quadro é ok mas o frete demorado desanima."])}`,
  () => `${pick(["A cor é um pouco diferente do anúncio.","O tamanho pareceu menor pessoalmente.","A foto do site não representa bem o produto.","Esperava um material mais grosso."])} ${pick(["Não é terrível, mas também não é o que eu esperava.","Serve, mas não me impressionou.","Pelo preço poderia ser melhor.","Vou manter, mas não estou 100% satisfeita."])}`,
  () => `${pick(["Achei o quadro simples demais.","O acabamento é básico.","Material mais ou menos.","Canvas meio fino."])} ${pick(["Para o preço que paguei, esperava algo melhor.","Não vou devolver, mas fiquei na dúvida.","Serve para decorar, mas não tem aquele 'uau'.","Poderia ter uma qualidade melhor de impressão."])}`,
];
const comments2 = [
  () => `${pick(["Decepcionante.","Não gostei.","Esperava muito mais.","Que decepção."])} ${pick(["A cor veio completamente diferente do anúncio.","O canvas veio com uma marca de dobra no meio.","O acabamento é de péssima qualidade.","O quadro veio torto e com defeito na moldura."])} ${pick(["Não recomendo.","Vou tentar devolver.","Dinheiro jogado fora quase.","Muito abaixo do esperado."])}`,
  () => `${pick(["O quadro veio danificado.","Chegou com a embalagem amassada.","A moldura veio quebrada.","O produto veio diferente do que pedi."])} ${pick(["O atendimento até tentou resolver mas demorou muito.","Tive que abrir reclamação para conseguir resposta.","Fiquei muito insatisfeita.","Péssima experiência de compra."])}`,
];
const comments1 = [
  () => `${pick(["Péssimo!","Horrível!","Não comprem!","Terrível!"])} ${pick(["O produto nunca chegou e não consigo contato.","Veio completamente diferente da foto, parece falsificação.","A impressão está toda borrada e o canvas descascando.","Moldura quebrada, canvas rasgado, uma vergonha."])} ${pick(["Vou abrir processo no Procon.","Quero meu dinheiro de volta.","Pior compra da minha vida.","Fraude total, não caiam nessa."])}`,
  () => `${pick(["Comprei e me arrependi amargamente.","Maior arrependimento de compra online.","Joguei meu dinheiro fora."])} ${pick(["A qualidade é absurdamente ruim, parece impressão de jato de tinta caseira.","O produto não tem nada a ver com as fotos do site.","Demorou 2 meses para chegar e veio todo destruído."])} ${pick(["Zero estrelas se pudesse.","Não comprem!","Empresa sem vergonha."])}`,
];

function getTitle(rating) {
  if (rating === 5) return pick(titles5);
  if (rating === 4) return pick(titles4);
  if (rating === 3) return pick(titles3);
  if (rating === 2) return pick(titles2);
  return pick(titles1);
}
function getComment(rating) {
  if (rating === 5) return pick(comments5)();
  if (rating === 4) return pick(comments4)();
  if (rating === 3) return pick(comments3)();
  if (rating === 2) return pick(comments2)();
  return pick(comments1)();
}

const reviews = [];
for (let i = 0; i < 497; i++) {
  const rating = getRating();
  const loc = pick(cities);
  reviews.push({
    name: `${pick(firstNames)} ${pick(lastInitials)}.`,
    rating,
    title: getTitle(rating),
    comment: getComment(rating),
    date: getDate(),
    verified: rand() < 0.9,
    city: loc.city,
    state: loc.state
  });
}
reviews.sort((a, b) => b.date.localeCompare(a.date));

const outPath = require('path').join(__dirname, 'reviews-data.json');
fs.writeFileSync(outPath, JSON.stringify(reviews, null, 2), 'utf-8');
console.log(`Generated ${reviews.length} reviews to ${outPath}`);
const counts = {1:0,2:0,3:0,4:0,5:0};
reviews.forEach(r => counts[r.rating]++);
console.log('Rating distribution:', counts);
console.log('Percentages:', Object.fromEntries(Object.entries(counts).map(([k,v]) => [k, (v/497*100).toFixed(1)+'%'])));
console.log('Verified:', reviews.filter(r => r.verified).length, '/', reviews.length);
