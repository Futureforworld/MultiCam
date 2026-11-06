# MultiCam --- Plataforma de Gerenciamento de CFTV

**Status:** Em desenvolvimento\
**Versão de referência do backend:** 0.2.0\
**Repositório:**
[Futureforworld/MultiCam](https://github.com/Futureforworld/MultiCam)

## 1. Sobre o projeto

O MultiCam é um projeto de desenvolvimento de uma plataforma
centralizada para gerenciamento de câmeras e dispositivos de
videomonitoramento (CFTV).

A proposta é simplificar a administração de instalações de segurança
eletrônica que utilizam equipamentos de diferentes fabricantes,
tecnologias e sistemas de gerenciamento.

O objetivo é evoluir para uma solução que permita centralizar
informações dos dispositivos, organizar clientes e instalações,
identificar equipamentos na rede e, progressivamente, integrar
diferentes tecnologias de videomonitoramento.

O projeto está sendo desenvolvido com foco em escalabilidade, segurança,
modularidade e aplicação prática em ambientes profissionais.

## 2. Objetivos

-   Centralizar o gerenciamento de clientes, dispositivos e câmeras.
-   Organizar equipamentos por cliente e instalação.
-   Implementar autenticação e controle de acesso.
-   Desenvolver mecanismos de descoberta de dispositivos em redes
    privadas.
-   Preparar uma arquitetura extensível para integração com diferentes
    fabricantes e protocolos.
-   Evoluir para uma interface unificada de monitoramento.

## 3. Tecnologias utilizadas

### Backend

-   JavaScript
-   Node.js
-   Fastify
-   JSON Web Token (JWT)
-   SQLite
-   Dotenv

### Segurança e autenticação

-   Autenticação baseada em JWT.
-   Hash de senhas com scrypt.
-   Controle de permissões por perfil.
-   Isolamento de acesso por cliente.
-   Limitação de tentativas de autenticação.

### Descoberta de dispositivos

-   Módulo de descoberta de redes IPv4 privadas.
-   Scanner de portas TCP.
-   Controle de concorrência.
-   Cancelamento de operações.
-   Identificação preliminar de possíveis serviços de CFTV.

### Desenvolvimento e qualidade

-   Git e GitHub.
-   npm.
-   Node.js Test Runner.
-   Testes automatizados.

## 4. Arquitetura do projeto

O projeto está organizado em módulos independentes, permitindo evolução
progressiva.

``` text
MultiCam/
│
├── backend/
│   ├── src/
│   │   ├── app.js
│   │   ├── database/
│   │   ├── discovery/
│   │   ├── routes/
│   │   ├── scripts/
│   │   └── services/
│   │
│   └── test/
│
├── docs/
├── frontend/
├── tests/
│
├── index.html
├── package.json
├── .env.example
└── .gitignore
```

## 5. Funcionalidades implementadas

### Gerenciamento

-   Cadastro e consulta de clientes.
-   Cadastro e consulta de dispositivos.
-   Cadastro e consulta de câmeras.
-   Organização dos equipamentos por cliente.
-   Visões gerais e diagnósticos de dispositivos.

### Autenticação e autorização

-   Login com autenticação JWT.
-   Perfis de superadministrador e administrador.
-   Controle de acesso aos clientes autorizados.
-   Proteção das rotas da API.
-   Armazenamento seguro de hashes de senhas.

### Descoberta de rede

-   Identificação de interfaces de rede.
-   Validação de endereços e redes privadas.
-   Varredura de portas TCP.
-   Controle de tarefas simultâneas.
-   Cancelamento de varreduras.
-   Identificação indicativa de possíveis serviços relacionados a CFTV.

**Importante:** a identificação por portas não confirma, isoladamente,
fabricante, modelo ou compatibilidade de um equipamento. A integração
efetiva com cada tecnologia depende de implementação e validação
específicas.

## 6. Qualidade e testes

O backend possui uma suíte automatizada de testes utilizando o Node.js
Test Runner.

Na versão de referência 0.2.0, foram executados:

-   162 testes aprovados.
-   0 falhas.
-   0 testes cancelados.

Os testes abrangem autenticação, autorização, banco de dados, rotas,
descoberta de rede, scanner TCP e identificação preliminar de serviços.

## 7. Roadmap --- próximas etapas

### Em planejamento e desenvolvimento

-   Evolução da interface centralizada.
-   Integração com dispositivos compatíveis com ONVIF.
-   Integração e gerenciamento de fluxos RTSP.
-   Avaliação de SDKs e APIs de fabricantes.
-   Ampliação da compatibilidade entre equipamentos.
-   Monitoramento de disponibilidade dos dispositivos.
-   Evolução dos recursos de visualização e gerenciamento.

As integrações acima não devem ser consideradas concluídas até que sejam
implementadas e testadas.

## 8. Execução local

Requisitos: - Node.js. - npm.

Na raiz do projeto, configure as variáveis de ambiente utilizando
`.env.example` como referência. Crie um `.env` próprio e preencha os
valores necessários, sem compartilhar credenciais.

Para instalar as dependências:

``` bash
cd backend
npm install
```

Para executar os testes:

``` bash
npm test
```

Para iniciar o servidor:

``` bash
npm start
```

A inicialização do superadministrador deve ser realizada somente em uma
base de dados nova, conforme as configurações administrativas
documentadas no ambiente local.

## 9. Evolução acadêmica e profissional

O MultiCam também representa um projeto prático de aplicação de
conhecimentos em desenvolvimento de software, arquitetura de sistemas,
banco de dados, segurança da informação, APIs e testes automatizados.

O desenvolvimento é conduzido de forma incremental, registrando
implementações, decisões técnicas, validações e melhorias.

## 10. Repositório

[GitHub ---
Futureforworld/MultiCam](https://github.com/Futureforworld/MultiCam)

------------------------------------------------------------------------

**MultiCam --- Desenvolvimento contínuo de uma plataforma integrada de
gerenciamento de CFTV.**
