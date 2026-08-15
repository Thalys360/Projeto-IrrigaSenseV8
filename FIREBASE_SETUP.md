# IrrigaSense 2.0 — configuração final do Firebase

## Projeto Firebase

- Project ID: `irrigasensev8`
- Realtime Database: `https://irrigasensev8-default-rtdb.firebaseio.com/`
- UID administrativo autorizado: `ruk4pA6CsNbkYmgKK90Dg0wc9s63`

## O que esta versão já faz

- Firebase Authentication com e-mail/senha;
- bloqueia o painel para qualquer UID diferente do administrador;
- Realtime Database em tempo real;
- configurações das duas zonas;
- cultura, mínimo e máximo;
- proteção noturna;
- calibração;
- perfis;
- histórico;
- vazões estimadas;
- modo manual com PIN salvo apenas como SHA-256;
- comandos manuais em fila;
- parada imediata;
- estados de confirmação do ESP/Arduino;
- status online/offline;
- última comunicação;
- galeria e fotos da equipe continuam locais enquanto não houver Firebase Storage.

## Aplicar as regras

No Firebase Console:

Realtime Database → Regras

Substitua as regras atuais pelo conteúdo de `database.rules.json` e publique.

IMPORTANTE: enquanto o ESP-01 ainda não tiver seu usuário próprio, o placeholder
`VYRVNNaHbxclxMv4EBWNz7yWtUW2` não corresponde a nenhum usuário.
Isso impede qualquer dispositivo de escrever telemetria ou executar comandos como dispositivo.

## Primeira inicialização

1. Publique o site.
2. Abra Painel do Administrador.
3. Entre com o e-mail/senha do usuário cujo UID é `ruk4pA6CsNbkYmgKK90Dg0wc9s63`.
4. Ao autenticar, o site cria automaticamente as configurações básicas ausentes no banco.
5. Salve Zona 1 e Zona 2 uma vez.

## Próxima etapa

A próxima etapa é firmware:
1. criar usuário Firebase exclusivo do ESP-01;
2. obter UID do dispositivo;
3. substituir o placeholder nas regras;
4. gravar o firmware do ESP-01;
5. gravar o firmware do Arduino Uno;
6. montar e testar sensores, relé, LEDs e bombas.


## UID do dispositivo

UID Firebase do ESP-01: `VYRVNNaHbxclxMv4EBWNz7yWtUW2`
