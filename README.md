# IrrigaSense 2.0 — Site completo corrigido

Este pacote foi preparado para substituir integralmente os arquivos atuais do GitHub Pages.

## Arquivos que devem ficar na raiz do repositório

- `index.html`
- `styles.css`
- `app.js`
- `firebase-bridge.js`
- `README.md`

## Publicação

1. Apague os arquivos antigos do site no repositório.
2. Envie todos os arquivos deste pacote para a raiz do repositório.
3. Mantenha o GitHub Pages configurado para `main` e `/(root)`.
4. Aguarde alguns minutos pela atualização do Pages.
5. Recarregue o site.

## Firebase

O site usa o projeto Firebase do IrrigaSense já configurado. O arquivo `firebase-bridge.js` contém somente a configuração pública do cliente web e o UID autorizado do administrador; ele não contém senha do administrador, senha do ESP ou token do Telegram.

O acesso administrativo é feito com Firebase Authentication (e-mail e senha). As regras do Realtime Database devem permitir leitura pública em `/irrigasense/config` e escrita somente pelo UID administrativo configurado.

## Fotos da equipe

As fotos de perfil agora são gerenciadas pelo **Painel do Administrador**:

1. Entre no Painel do Administrador.
2. Faça login com a conta administrativa do Firebase.
3. Vá até **Fotos de perfil da equipe**.
4. Escolha a imagem de uma pessoa e clique em **Salvar foto**.

A imagem é reduzida/comprimida no navegador e salva em `/irrigasense/config/teamPhotos`. Assim, ela continua aparecendo depois de atualizar a página e também em outros aparelhos.

## Galeria

As fotos da galeria também são comprimidas e salvas no Firebase em `/irrigasense/config/gallery`. A ordem definida pelo administrador é sincronizada para todos os visitantes.

## Recursos do site

- 2 zonas independentes;
- 21 culturas + opção personalizada;
- limites mínimo/máximo e proteção noturna;
- controle manual temporizado;
- Firebase Authentication e Realtime Database;
- histórico e confirmação de comandos;
- gráficos de umidade e consumo estimado;
- perfis e calibração;
- conectividade e Telegram;
- galeria persistente;
- fotos da equipe persistentes;
- painel administrativo;
- central de ajuda;
- layout responsivo para celular e computador.

## Segurança

Nunca publique no repositório:

- senha da conta administrativa;
- senha da conta Firebase do ESP;
- token do Telegram;
- `Secrets.h` do firmware.

A configuração web pública do Firebase presente em `firebase-bridge.js` não substitui as regras de segurança do banco.


## Correção de galeria — 15/08/2026

Esta revisão corrige o desaparecimento de fotos quando muitas imagens eram adicionadas.
As imagens não são mais gravadas no `localStorage` do navegador; ficam no Firebase.
O site também tenta recuperar fotos da versão anterior que ainda estejam no armazenamento local do aparelho e as mantém em memória para sincronização posterior.
As novas imagens são reduzidas antes do envio para diminuir o peso da galeria.
