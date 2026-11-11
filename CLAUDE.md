# Universe Loner — guia rápido para o Claude

Jogo de texto, futurista, em HTML, CSS e JS puros (sem build, sem npm).
O jogador começa na Terra, em Nova Aurora, pega turnos de trabalho, espera o
tempo passar e recebe créditos, XP e itens. Não há mapa (o dono mandou tirar).
Este arquivo existe para economizar uso: leia-o em vez de reexplorar o projeto,
e mantenha-o atualizado quando a estrutura mudar.

## Como trabalhar aqui (economia de uso)

- Responda em português, curto. O dono do projeto dita os pedidos por voz;
  interprete o sentido e siga, sem pedir confirmação para coisas pequenas.
- Não releia arquivos inteiros. Use Grep para achar o trecho e Edit direto.
- Confira no navegador só mudanças visuais ou de fluxo, com poucos prints.
- Não há `git` nem `node` no terminal. Só `python`. O dono faz commit e push
  pelo GitHub Desktop.
- Não crie arquivos de documentação além deste.
- Tudo é futurista. O dono rejeitou visual "de criança": prefira texto, painéis
  e barras a desenhos feitos por código.

## Arquivos

| Arquivo | O que tem |
|---|---|
| `index.html` | Estrutura fixa: topo, entrada (`#view-home`), nick (`#view-nick`) e o jogo (`#view-game`: lateral + `#content`) |
| `style.css` | Tema (variáveis em `:root`), painéis, barras, tabela, banco, perfil |
| `script.js` | Módulo ES: Firebase, regras do jogo, ações e páginas |
| `Planetas/Terra.png` | Imagem da Terra (sem uso no momento) |
| `firestore.rules` | Cópia das regras publicadas no Firestore (publicar é manual, no console) |

## Como o jogo funciona (`script.js`)

- Página única; a rota é o hash: `#cidade`, `#trabalhos`, `#mercado`,
  `#banco`, `#perfil`. Sem login, tudo mostra a entrada (`#home`).
- `render()` decide a tela. As páginas do jogo são funções que devolvem HTML
  (`pageCidade`, `pageTrabalhos`, `pageMercado`, `pageBanco`, `pagePerfil`,
  registradas em `PAGE_RENDERERS`) e vão para `#content`.
- Botões usam `data-action="..."`; o mapa `ACTIONS` liga cada um à função.
- Números ajustáveis ficam no bloco "REGRAS DO JOGO": `SHIFT_MINUTES` (30),
  `PAY_MIN`/`PAY_MAX` (30 a 57), `XP_PER_SHIFT` (10), `SKILL_XP_PER_SHIFT` (8),
  `DROP_CHANCE` (10% por item, sorteado separado), `LEVEL_BASE`, `SKILL_BASE`.
- `ITEMS`: itens e preço de venda. `JOBS`: trabalhos (minerador e traficante),
  cada um com `skill`, `drops` (5 itens) e `bonusCredits` opcional.
  Trabalho novo = uma entrada em `JOBS` (a habilidade aparece sozinha no perfil).
- Nível infinito: `levelInfo(totalXp, base)`; cada nível pede
  `base * nível^1.5` de XP. O dono quer progressão BEM lenta.
- Turno: `startJob` grava `job: { id, startedAt, endsAt }`; `collectJob`
  sorteia pagamento e itens quando o tempo acaba. Um turno por vez.
- `savePlayer(patch)` grava no Firestore e só então muda a tela.
- Tudo roda no navegador do jogador: dá para trapacear. Tornar seguro exige
  servidor (Cloud Functions). O dono ainda não pediu isso.

## Firebase (projeto `loner-hq`)

- Auth: Google, por pop-up. Domínios autorizados: `localhost`,
  `lohnner.github.io`.
- Firestore: `players/{uid}` = `{ nick, nickLower, createdAt, credits, bank,
  xp, skills: { miner, dealer }, items: { id: qtd }, job, shifts }`;
  `nicks/{nickLower}` = `{ uid }` (garante nick único).
  `normalizePlayer()` preenche o que faltar em contas antigas.
- As regras atuais já deixam o dono gravar no próprio documento. Coleção nova
  exige regra nova.

## Testar sem login

O Google exige a conta do dono, então não tente logar. Rode o `script.js` real
com o Firebase falso, pelo console da página: baixe o texto do script, remova
os `import`, prefixe stubs (`onAuthStateChanged` chamando o callback com um
usuário falso; `getDoc` devolvendo um jogador; `updateDoc` guardando os
patches) e importe por Blob URL. Para testar o fim de um turno, devolva no
`getDoc` um `job` com `endsAt` no passado.

## Versão e publicação

- Publicado em `https://lohnner.github.io/Universe-Loner/` (GitHub Pages,
  repositório `lohnner/Universe-Loner`, branch `main`).
- A versão aparece em três lugares do `index.html`: `style.css?v=`,
  `script.js?v=` e o texto do `<div class="version">`. O dono escolhe o número.
  Sempre que ele informar uma versão nova, troque os três; sem isso o
  navegador usa CSS e JS antigos e o site quebra.

## Ver o site localmente

```
python -m http.server 5500 --bind 127.0.0.1
```

Abrir `http://localhost:5500`. Módulos ES não funcionam abrindo o arquivo
com dois cliques.
