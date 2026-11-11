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
- Rotas: `#home`, `#perfil`, `#universo`, `#planeta/<id>`,
  `#planeta/<id>/trabalhos`.
- Telas (`views`): `home`, `nick`, `profile`, `universe`, `planet`.
  A tela `planet` tem dois painéis: `#planet-info` e `#planet-jobs`.
- Universo e planetas só abrem para quem está logado e tem nick.
- Planetas ficam na lista `PLANETS` (id, name, image, description, facts).
  Novo planeta = imagem em `Planetas/` + uma entrada na lista.
- Layout: `.game-box` tem 1280 de largura, centralizada, altura livre.
  Tudo do jogo fica dentro dela. Telas estreitas usam `.view` (720);
  telas largas usam `.view-wide`.

## Firebase (projeto `loner-hq`)

- Auth: Google, por pop-up. Domínios autorizados: `localhost`,
  `lohnner.github.io`.
- Firestore: `players/{uid}` = `{ nick, nickLower, createdAt }`;
  `nicks/{nickLower}` = `{ uid }` (garante nick único).
- Dado novo do jogador vai em `players/{uid}`; as regras atuais já deixam o
  dono gravar no próprio documento. Coleção nova exige regra nova.

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
