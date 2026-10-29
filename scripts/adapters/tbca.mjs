// Ponto de integração com a TBCA/USP (Tabela Brasileira de Composição de Alimentos).
// NÃO está ativo: o uso comercial exige contato com os coordenadores (https://www.tbca.net.br/),
// e o site não estava acessível deste ambiente. Nenhum dado da TBCA foi importado.
//
// A TBCA descreve alimentos genéricos, in natura e preparações. Ela não substitui o rótulo de um
// produto de marca. Quando houver autorização, cada item deve virar um Produto com:
//   kind: 'generico', brand: null (sem marca fictícia), gtin: null, quantity: null,
//   id: 'tbca:<código TBCA>', nutrition.per100 com os valores e unidades publicados,
//   provenance[0]: { source: 'tbca', ref: <código>, url, fetchedAt, license: <termos autorizados>,
//                    verification: 'tabela de composição (análise laboratorial/compilação)' }.
// Esses itens devem ficar num arquivo próprio (ex.: data/produtos-genericos/), separado da base
// derivada do Open Food Facts, para não misturar licenças.

export const SOURCE = 'tbca';

export async function importTbca() {
  throw new Error('TBCA não configurada: requer autorização dos coordenadores para o uso pretendido.');
}
