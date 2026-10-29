// Ponto de integração com a GS1 Brasil (Cadastro Nacional de Produtos / API de consulta por GTIN).
// NÃO está ativo: o acesso depende de plano pago e liberação da GS1 Brasil
// (https://portalapi.gs1br.org/pageApiProvider). Nenhuma credencial foi configurada.
//
// Quando houver contrato, este adaptador deve:
// 1. ler a credencial de uma variável de ambiente (ex.: GS1BR_TOKEN), nunca do código;
// 2. consultar um GTIN por vez, respeitando o limite do plano;
// 3. devolver um Produto no formato de src/products.js com provenance[0].source = 'gs1br',
//    a licença/contrato em `license` e o estado de verificação informado pela GS1;
// 4. ser mesclado com mergeProduct(): a GS1 tem prioridade sobre o OFF, e o registro do OFF
//    fica em `alternatives`, com divergências visíveis.
// Confirme no contrato se os dados podem ser redistribuídos num app público antes de publicá-los.

export const SOURCE = 'gs1br';

export async function productByGtin() {
  throw new Error('GS1 Brasil não configurada: requer contrato e credencial autorizados pelo dono do projeto.');
}
