# Contrato Firebase para o ESP-01

Esta versão do site já está preparada para o firmware.

## Autenticação do dispositivo

O ESP-01 NÃO deve usar a conta administrativa.

Quando formos programar o ESP-01, criaremos um segundo usuário no Firebase Authentication,
exclusivo para o dispositivo. O UID desse usuário substituirá:

VYRVNNaHbxclxMv4EBWNz7yWtUW2

em `database.rules.json`.

## Leituras do ESP-01

O ESP deve ler:

- `/irrigasense/zonas/zona1/config`
- `/irrigasense/zonas/zona2/config`
- `/irrigasense/calibracao/sensor1`
- `/irrigasense/calibracao/sensor2`
- `/irrigasense/sistema/config`
- `/irrigasense/comandos`

## Escritas do ESP-01

O ESP deve escrever:

- `/irrigasense/zonas/zona1/telemetry`
- `/irrigasense/zonas/zona2/telemetry`
- `/irrigasense/sistema/telemetry`
- status dos comandos em `/irrigasense/comandos/{id}`
- confirmações em `/irrigasense/confirmacoes/{id}`
- eventos em `/irrigasense/historico/{id}`

## Estados de comando

1. `pendente` — criado pelo site.
2. `recebido` — ESP-01 leu o comando.
3. `executando` — Arduino confirmou início.
4. `concluido` — Arduino confirmou fim.
5. `erro` — falha.
6. `cancelado` — comando cancelado.

## Exemplo de comando

```json
{
  "id": "-firebasePushId",
  "zona": 1,
  "acao": "IRRIGAR",
  "duracaoSegundos": 15,
  "status": "pendente",
  "origem": "site"
}
```

## Telemetria de uma zona

```json
{
  "umidade": 67,
  "bomba": false,
  "raw": 612,
  "ultimaLeitura": 1786760000000
}
```

## Comunicação ESP-01 ↔ Arduino

O firmware será preparado para uma serial simples, por exemplo:

- ESP → Arduino: `CFG,1,60,80`
- ESP → Arduino: `MAN,1,15`
- ESP → Arduino: `STOP,1`
- Arduino → ESP: `TEL,1,67,0,612`
- Arduino → ESP: `ACK,COMMAND_ID,EXECUTING`
- Arduino → ESP: `ACK,COMMAND_ID,DONE,15`

O Arduino continua responsável pela automação local e segurança mesmo sem internet.
