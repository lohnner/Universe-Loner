# Universe Loner — guia rápido para o Claude

Jogo de exploração espacial em HTML, CSS e JS puros (sem build, sem npm).
Este arquivo existe para economizar uso: leia-o em vez de reexplorar o projeto,
e mantenha-o atualizado quando a estrutura mudar.

## Como trabalhar aqui (economia de uso)

- Responda em português, curto. O dono do projeto dita os pedidos por voz;
  interprete o sentido e siga, sem pedir confirmação para coisas pequenas.
- Não releia arquivos inteiros. Use Grep para achar o trecho e Edit direto.
  Os três arquivos são pequenos e a estrutura está descrita abaixo.
- Não dá para testar login: o Google exige a conta do dono. Não tente.
  Para conferir visual, force a tela a aparecer pelo console
  (`view-home.hidden = true; view-X.hidden = false`) e tire UM print por tela.
- Confira no navegador só mudanças visuais. Mudança de texto ou de dado
  (ex.: novo planeta na lista) não precisa de print.
- Não há `git` nem `node` no terminal. Só `python`. O dono faz commit e push
  pelo GitHub Desktop.
- Não crie arquivos de documentação além deste.

## Arquivos

| Arquivo | O que tem |
|---|---|
| `index.html` | Todas as telas, cada uma numa `<section class="view" id="view-...">` dentro de `<main class="game-box">` |
| `style.css` | Tema (variáveis em `:root`), topo, caixa do jogo, cartões, planeta |
| `script.js` | Módulo ES: Firebase, fundo de estrelas, estado, login, nick, telas |
| `Planetas/` | Imagens dos planetas (`Terra.png`). O P é maiúsculo; o GitHub diferencia |
| `firestore.rules` | Cópia das regras publicadas no Firestore (publicar é manual, no console) |

## Como o site funciona

- Página única. A rota é o hash; `render()` em `script.js` decide qual
  `view` mostrar e `show(nome)` esconde as outras e marca o link do topo.
- Rotas: `#home`, `#perfil`, `#local`, `#local/trabalhos`.
  `#local` abre o planeta onde o jogador está (`currentPlanet()`).
- Topo: Home e Local. O Universo está FECHADO por decisão do dono: todo
  jogador começa na Terra e vai ter que trabalhar e juntar dinheiro para sair.
  A tela `universe` e `buildUniverse()` continuam no código, sem rota.
- Telas (`views`): `home`, `nick`, `profile`, `universe`, `planet`.
  A tela `planet` tem painel à esquerda (`#planet-info` ou `#planet-jobs`)
  e mapa à direita (`#planet-map`: SVG fixo no HTML + locais criados pelo JS).
- Só abre para quem está logado e tem nick.
- Planetas ficam na lista `PLANETS` (id, name, image, description, facts,
  places). Cada `place` tem id, name, x e y (pixels do mapa), w e h (área
  clicável), markerDy (altura do marcador "Você"). O jogador começa no
  primeiro place (Nova Aurora).
- `mapa.js` (script comum, não módulo) desenha o mapa da Terra em SVG por
  código (2000x1300, isométrico) e expõe `window.UL_MAPS.terra`. As posições
  das cidades e da mina ficam no topo dele e PRECISAM bater com os `places`
  do `script.js`. Nova Aurora = casas baixas; Porto Azul e Vale Central =
  arranha-céus. Não leia o arquivo inteiro: procure a seção pelo comentário.
- O mapa é maior que a janela (`#planet-map`) e arrasta com o mouse
  (`setPan`, `centerMapOn` em `script.js`).
- Viagem: clicar num local mostra os detalhes e o botão "Viajar para cá";
  `travelTo()` move o marcador e grava `players/{uid}.location`.
- Teste sem login: dá para rodar o `script.js` real com o Firebase falso.
  No console: baixar o texto do script, remover os `import`, prefixar stubs
  (`onAuthStateChanged` chamando o callback com um usuário falso, `getDoc`
  devolvendo `{nick}`) e importar por Blob URL.
- Layout: `.game-box` tem 1280 de largura, centralizada, altura livre.
  Tudo do jogo fica dentro dela. Telas estreitas usam `.view` (720);
  telas largas usam `.view-wide`.

## Firebase (projeto `loner-hq`)

- Auth: Google, por pop-up. Domínios autorizados: `localhost`,
  `lohnner.github.io`.
- Firestore: `players/{uid}` = `{ nick, nickLower, createdAt, location: { planet, place } }`;
  `nicks/{nickLower}` = `{ uid }` (garante nick único).
- Dado novo do jogador vai em `players/{uid}`; as regras atuais já deixam o
  dono gravar no próprio documento. Coleção nova exige regra nova.

## Versão e publicação

- Publicado em `https://lohnner.github.io/Universe-Loner/` (GitHub Pages,
  repositório `lohnner/Universe-Loner`, branch `main`).
- A versão aparece em quatro lugares do `index.html`: `style.css?v=`,
  `mapa.js?v=`, `script.js?v=` e o texto do `<div class="version">`. O dono escolhe o número.
  Sempre que ele informar uma versão nova, troque os três; sem isso o
  navegador usa CSS e JS antigos e o site quebra.

## Ver o site localmente

```
python -m http.server 5500 --bind 127.0.0.1
```

Abrir `http://localhost:5500`. Módulos ES não funcionam abrindo o arquivo
com dois cliques.
