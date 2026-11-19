# Política de privacidade do Precivora

Vigente desde 19/11/2026.

O Precivora é um app gratuito e de código aberto para anotar e comparar preços. Esta política explica, em linguagem simples, o que acontece com os seus dados, conforme a Lei Geral de Proteção de Dados (LGPD, Lei nº 13.709/2018).

## Resumo

- Não existe conta, cadastro, servidor do Precivora, anúncio nem rastreador.
- Tudo o que você anota fica guardado só no seu aparelho.
- O desenvolvedor do Precivora não recebe nenhum dado seu.
- Algumas funções consultam serviços públicos na internet. Elas estão listadas abaixo, com o que é enviado e quando. As automáticas podem ser desligadas em **Mais → Privacidade**.

## O que fica no seu aparelho

- Lugares (nome, endereço, CNPJ quando vem da nota fiscal), produtos, preços, compras, listas, avaliações, orçamento e ajustes.
- O nome que você informar para a saudação da tela inicial (opcional).
- Da nota fiscal, só o emitente (a loja), os itens, os valores, a data e a chave de acesso, que serve para não importar a mesma nota duas vezes. **O CPF ou o nome do consumidor, que aparecem em algumas notas, são ignorados e não ficam guardados.**
- A sua localização, quando você toca em "Perto de mim" ou num filtro de distância. Ela é usada só para calcular distâncias, fica guardada por no máximo 5 minutos e não é enviada a ninguém.
- Os backups que você exporta e as cópias do backup automático (pasta `Documentos/Precivora`). Esses arquivos ficam na memória do aparelho e podem ser abertos por outros apps com acesso a arquivos ou por um computador ligado ao celular. Guarde e compartilhe com cuidado.

Ninguém além de você tem acesso a esses dados pelo Precivora.

## O que sai do aparelho, e para onde

Cada consulta abaixo vai direto do seu aparelho para o serviço indicado. Como em qualquer acesso à internet, o serviço também recebe o endereço IP e dados técnicos da conexão, e trata essas informações conforme a política dele.

- **Secretaria da Fazenda de Santa Catarina**, quando você importa uma nota fiscal. A página de consulta da nota abre dentro do app com o link do QR Code ou a chave de acesso. A verificação de segurança da página ("Validar") é da própria Fazenda. A página pode guardar cookies dentro do app; eles são apagados ao desinstalar o app ou ao limpar os dados dele nas configurações do Android.
- **Open Food Facts** ([política](https://world.openfoodfacts.org/privacy)), quando você lê ou digita um código de barras no cadastro de produto ou no registro de preço. Vai só o número do código. A foto do produto, quando existe, também vem de lá.
- **ANP (Agência Nacional do Petróleo)**, quando você toca em "Atualizar" nos preços oficiais, liga "Atualizar sozinho" ou liga "Avisar preço baixo". O app baixa o arquivo público do levantamento de preços. Nada sobre você é enviado. Com "Avisar preço baixo" ligado, o download acontece uma vez por dia, no horário escolhido, mesmo com o app fechado; a comparação com os seus preços é feita no aparelho e o aviso é uma notificação do próprio Android.
- **OpenStreetMap, serviço Nominatim** ([política](https://osmfoundation.org/wiki/Privacy_Policy)), para colocar os lugares no mapa. Vai só o endereço do lugar cadastrado (rua, número, bairro e cidade), um por segundo. Isso acontece sozinho, em segundo plano, e pode ser desligado em **Mais → Privacidade**. Se você cadastrar um endereço residencial, ele também será enviado; nesse caso, desligue a função ou deixe o endereço em branco.
- **OpenStreetMap, imagens do mapa** ([política](https://osmfoundation.org/wiki/Privacy_Policy)), quando você abre a tela Mapa. O serviço recebe os pedaços do mapa que estão sendo vistos, o que indica a região para onde você está olhando.
- **Google Maps**, quando você toca em "Abrir no mapa" ou "Rotas". O Google Maps abre com o endereço ou o destino escolhido, e o Google trata os dados conforme a política dele.
- **GitHub** ([política](https://docs.github.com/pt/site-policy/privacy-policies/github-general-privacy-statement)), no app Android, ao abrir o app, no máximo uma vez por dia, para saber se saiu uma versão nova. Nada sobre você é enviado. Pode ser desligado em **Mais → Privacidade**. Quando você toca em "Baixar e instalar", o arquivo da versão nova vem do GitHub.
- **Serviços do Google Play** ([política](https://policies.google.com/privacy)), no app Android. O leitor de QR Code e de código de barras é baixado pelo próprio Android e lê a imagem da câmera no aparelho. A janela "Ligar localização" e a "Precisão de Local" também são do Google.

## Seus direitos (art. 18 da LGPD)

Como os dados ficam só no seu aparelho, você mesmo exerce os seus direitos, sem precisar pedir a ninguém:

- **Saber quais dados existem e acessá-los:** todas as telas do app mostram o que está guardado. Em **Mais → Backup**, "Exportar backup" gera um arquivo com tudo.
- **Corrigir:** edite qualquer cadastro, preço, compra ou avaliação no próprio app.
- **Levar para outro lugar (portabilidade):** o backup é um arquivo JSON aberto, que pode ser lido por outros programas.
- **Apagar:** exclua itens um a um, use **Ajustes → Apagar todos os dados** e, se quiser, **Backup → Backup automático → Apagar cópias**. Desinstalar o app também apaga tudo o que fica dentro dele.
- **Saber com quem há compartilhamento:** está na lista acima.
- **Desligar os envios automáticos:** em **Mais → Privacidade**.

## Crianças

O Precivora não é direcionado a crianças e não coleta dados de ninguém.

## Mudanças nesta política

Se o app passar a enviar algum dado novo, esta política será atualizada antes, com a nova data de vigência. A versão atual fica sempre no app (**Mais → Privacidade**) e no repositório do projeto.

## Contato

Dúvidas ou pedidos sobre privacidade: abra uma *issue* em [github.com/Eduardochimchek/precivora/issues](https://github.com/Eduardochimchek/precivora/issues). Lembre que o desenvolvedor não tem acesso aos seus dados, então não envie dados pessoais na mensagem.
