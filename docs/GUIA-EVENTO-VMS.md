# 🏆 Copa do Mundo Azure — Guia do Evento TFTEC (FIFA 2026 Tickets — cenário VM)

> ⚽ **Bem-vindo(a) ao gramado!** Neste evento você vai **construir do zero** o seu próprio ambiente em nuvem e colocar no ar a aplicação **FIFA 2026 Tickets** — a bilheteria oficial (fictícia) da Copa do Mundo — em **3 Máquinas Virtuais**.
>
> 🥅 **Para todos os níveis.** Você não precisa ser sênior. Cada passo é explicado em detalhe, com o **caminho visual pelo Portal do Azure** sempre que possível — aqui a ideia é **entender o que você está fazendo**.

> 🚧 **Documento vivo.** Itens marcados com _⚠️ a confirmar_ serão fixados conforme o evento se aproxima (ex.: URL do repositório público, dataset do banco). A estrutura, a arquitetura e os passos já valem.

> 🎟️ **Tem um app irmão!** Existe também o **Bolão TFTEC** (palpites). Este guia é o do **Tickets** (venda de ingressos) — arquitetura diferente (banco **relacional** + 3 VMs). Se você for fazer os dois, repare nas diferenças: é parte do aprendizado.

> 🖥️ **Escopo deste guia: 100% Máquinas Virtuais.** Aqui você monta a aplicação inteira **em VMs** — rede, SQL Server, IIS, Node e proxy reverso, tudo na sua mão. _Hospedar a mesma app com serviços gerenciados (App Service Plan / Web Apps) é assunto de **outra etapa**, fora do escopo deste documento._

> 📐 **Por onde começamos: planta antes de tijolo.** Nosso primeiro trabalho **não** é clicar no Portal. É **definir um padrão de taxonomia** (como nomear cada recurso) e **desenhar a arquitetura** da nossa aplicação — regiões, redes, isolamento. **Só depois** disso, com a planta fechada e os nomes acordados, partimos para a parte técnica (provisionar e configurar). Por isso a **Fase 1 é de desenho**, e as mãos na massa começam na Fase 2.

---

## 📋 Índice

1. [Sobre a aplicação](#-1-sobre-a-aplicação)
2. [Objetivos do evento](#-2-objetivos-do-evento)
3. [Tecnologias Azure que vamos usar](#-3-tecnologias-azure-que-vamos-usar)
4. [Arquitetura da aplicação](#-4-arquitetura-da-aplicação)
5. [A jornada do aluno](#-5-a-jornada-do-aluno)
   - [Fase 0 — Pré-requisitos](#fase-0--pré-requisitos)
   - [Fase 1 — Desenho de arquitetura](#fase-1--desenho-de-arquitetura)
   - [Fase 2 — Provisionar a rede e as VMs](#fase-2--provisionar-a-rede-e-as-vms)
   - [Fase 3 — Configurar a `vm-data` (SQL Server + bacpac)](#fase-3--configurar-a-vm-data-sql-server--bacpac)
   - [Fase 4 — Configurar a `vm-bend` (backend Node)](#fase-4--configurar-a-vm-bend-backend-node)
   - [Fase 5 — Configurar a `vm-fend` (frontend + proxy reverso)](#fase-5--configurar-a-vm-fend-frontend--proxy-reverso)
   - [Fase 6 — Domínio (DNS) + certificado wildcard HTTPS](#fase-6--domínio-dns--certificado-wildcard-https)
   - [Fase 7 — Smoke test](#fase-7--smoke-test)
   - [Fase 8 — Hardening final: remover IPs públicos + jump host](#fase-8--hardening-final-remover-ips-públicos--jump-host)
   - [Fase 9 — Troubleshooting + desligar as VMs](#fase-9--troubleshooting--desligar-as-vms)
6. [Tabela de variáveis e segredos](#-6-tabela-de-variáveis-e-segredos)
7. [Evolução de segurança (o "VAR" da arquitetura)](#️-7-evolução-de-segurança-o-var-da-arquitetura)

---

## ⚽ 1. Sobre a aplicação

O **FIFA 2026 Tickets** é a **bilheteria** (fictícia, educacional) da Copa do Mundo 2026: o torcedor navega pelos jogos, estádios e seleções, escolhe um setor e **compra ingressos**, recebendo um **ingresso premium com QR code** validável.

É uma aplicação **3 camadas clássica** — o pão-com-manteiga da web corporativa:

- 🎟️ **Catálogo** de jogos (104 partidas), 17 estádios oficiais e 49 seleções
- 🛒 **Fluxo de compra** com ocupação por jogo e bloqueio de esgotado
- 🪪 **Ingresso premium** com QR code real + página de validação
- 📊 **Painel admin** (vendas, usuários, resultados) com paginação server-side
- 🔐 **Autenticação própria** (JWT) + papel admin
- 📚 Conteúdo: História das Copas, quiz, bracket do mata-mata

> 💡 **Por que esse app em Máquinas Virtuais?** Ele ensina **operação real de infraestrutura**: você instala IIS, Node.js e iisnode **com as suas próprias mãos**, provisiona um SQL Server, configura NSG e monta um padrão **jump host**. É o cenário que TI corporativa **ainda mantém** em muitos lugares — saber operar isso é diferencial.

---

## 🎯 2. Objetivos do evento

Ao final, você terá feito **com as suas próprias mãos**:

| # | Você vai aprender a... |
|---|---|
| 1 | **Desenhar a arquitetura** antes de criar: regiões, VNets/subnets, faixas de IP e uma **taxonomia de nomes** consistente |
| 2 | Criar **2 VNets + subnets + 2 NSGs** (associadas a subnets) e **peering global** entre regiões |
| 3 | Provisionar **3 Máquinas Virtuais Windows Server** (com IP público no início) e administrá-las por **RDP** |
| 4 | Provisionar uma VM com **imagem SQL Server 2022 pronta** (sem instalar nada — só configurar a **autenticação SQL** no wizard) e **restaurar um banco via `.bacpac`** |
| 5 | Instalar e configurar **IIS + iisnode + Node** para hospedar uma API Express no Windows |
| 6 | Instalar **URL Rewrite + ARR** para fazer **proxy reverso** `/api/*` → backend |
| 7 | **Endurecer a segurança no final**: remover IPs públicos do back/db e migrar para acesso via **jump host** |

> 🧠 **Filosofia:** **Portal-first** (clicar e ver). PowerShell e `az cli` apenas **dentro da VM via RDP** ou para desligar tudo no final. Você sai sabendo **o que cada peça faz e por quê**.

> ⏱️ **O que esperar de tempo:** ~45 min para subir as VNets/VMs + ~1h instalando e configurando software (SQL, IIS, Node, proxy). É mais lento do que clicar em "deploy", e **isso é proposital** — você vê cada peça que normalmente fica escondida.

---

## ☁️ 3. Tecnologias Azure que vamos usar

Tudo dentro de **um Resource Group** (`rg-prd-tik-cin-001`). Os nomes seguem um **padrão de taxonomia** que você vai definir na Fase 1 — para facilitar a leitura, no texto usamos os apelidos **vm-fend** (frontend), **vm-bend** (backend) e **vm-data** (banco).

| Serviço Azure | Nome (taxonomia) | Para que serve | Camada / Custo |
|---|---|---|---|
| 🌐 **VNet de aplicação** (Central India) | `vnet-prd-inf-cin-001` | `10.20.0.0/16` — hospeda frontend e backend | Grátis |
| 🌐 **VNet de banco** (Australia East) | `vnet-prd-inf-aes-001` | `10.30.0.0/16` — hospeda o banco | Grátis |
| 🔗 **VNet Peering (global)** | — | Liga as 2 VNets/regiões pelos IPs privados. Duas regiões porque o limite é **4 vCPU/região** e 3× B2s = 6 vCPU | ~centavos (tráfego entre regiões) |
| 🏷️ **NSG de aplicação** | `nsg-prd-inf-cin-001` | **Uma só** NSG associada às **duas subnets** de app (frontend + backend) | Grátis |
| 🏷️ **NSG de banco** | `nsg-prd-inf-aes-001` | NSG associada à subnet de banco | Grátis |
| 🖥️ **VM frontend** | `vm-prd-tk-fend-cin-001` | Windows Server 2022, B2s — IIS + ARR (ponto de entrada da Internet) | B2s ~$30/mês (24/7) |
| 🖥️ **VM backend** | `vm-prd-tk-bend-cin-001` | Windows Server 2022, B2s — IIS + iisnode + Node (API) | B2s ~$30/mês (24/7) |
| 🖥️ **VM banco** | `vm-prd-tk-data-aes-001` | Imagem **SQL Server 2022 on Windows Server 2022**, B2s — SQL já instalado; você só ativa a auth SQL e restaura o banco | B2s ~$30/mês (24/7) |
| 💾 **Managed Disks** (3 × 127 GB) | (auto) | Disco do OS de cada VM | inclusos |

> 🌐 **IP público em TODAS as VMs no início.** Para o setup ser direto, as **3 VMs sobem com IP público** e você faz RDP em cada uma sem desvios. **Só no final** (Fase 8), com tudo funcionando, você **remove o IP público** do backend e do banco e passa a acessá-los via **jump host** — endurecendo a segurança como último passo. Aprender "primeiro funciona, depois tranca" é parte da lição.

> 💰 **Custo total real:** ~**$90/mês** se as 3 VMs ficarem **24/7**. Mas você **NÃO precisa deixar ligado** — use `az vm deallocate` ao final de cada sessão (passo na Fase 9) e o compute para de cobrar (paga só ~$5/mês por disco). Configure um **alerta de orçamento** (Fase 0).

> 🔐 **Sobre segredos:** este cenário VM usa **arquivos `.env` nos próprios servidores** (vm-bend) + **credenciais do SQL definidas no wizard da VM** (`adminsql`). Modelo simples, mas frágil — qualquer um com acesso à VM lê o `.env`. _Boa prática de produção:_ migrar segredos para um **Azure Key Vault** com Managed Identity — fora do escopo deste guia.

---

## 🗺️ 4. Arquitetura da aplicação

O "mapa do ambiente" — **Cenário 3 VMs, 2 VNets, 2 NSGs** (o que você vai montar):

```
                          🌎 TORCEDOR (navegador / celular)
                                      │  HTTP/HTTPS
                                      ▼
  ┌────────────────────────── vnet-prd-inf-cin-001  (Central India, 10.20.0.0/16) ──────────────────────────┐
  │  🏷️ NSG  nsg-prd-inf-cin-001  (associada às DUAS subnets abaixo)                                          │
  │                                                                                                          │
  │  ┌── snet-prd-inf-fend-cin-001 (10.20.1.0/24) ──┐   ┌── snet-prd-inf-bend-cin-001 (10.20.2.0/24) ──┐     │
  │  │  🌐 vm-prd-tk-fend-cin-001  (vm-fend)         │   │  🔒 vm-prd-tk-bend-cin-001  (vm-bend)        │     │
  │  │  • IIS :80/:443  servindo dist/ do React      │   │  • IIS + iisnode :80 (API)                   │     │
  │  │  • URL Rewrite + ARR (proxy reverso)          │──▶│  • Node executa fifa2026-api/                │     │
  │  │  • web.config: reescreve /api/* ──────────────┼──▶│  • .env → IP privado da vm-data (10.30.1.x)  │     │
  │  └───────────────────────────────────────────────┘   └──────────────────────┬───────────────────────┘     │
  └─────────────────────────────────────────────────────────────────────────────┼──────────────────────────┘
                                                                                 │ mssql 1433 (IP privado)
        ═══════════════════════════ 🔗 VNET PEERING GLOBAL ══════════════════════╪══════════════════════════
                                                                                 ▼
  ┌──────────────────── vnet-prd-inf-aes-001  (Australia East, 10.30.0.0/16) ─────────────────────────────┐
  │  🏷️ NSG  nsg-prd-inf-aes-001                                                                           │
  │  ┌── snet-prd-inf-data-aes-001 (10.30.1.0/24) ──────────────────────────────────────────────────────┐ │
  │  │  🟥 vm-prd-tk-data-aes-001  (vm-data)  — imagem SQL Server 2022 (já instalado)                     │ │
  │  │  • Autenticação SQL: adminsql (configurada no wizard) · Database FIFA2026Tickets (do bacpac)       │ │
  │  └────────────────────────────────────────────────────────────────────────────────────────────────┘ │
  └──────────────────────────────────────────────────────────────────────────────────────────────────────┘

   🌐 Durante o lab: as 3 VMs têm IP público → RDP direto em cada uma.
   🔒 Na Fase 8 (hardening final): remove-se o IP público de vm-bend e vm-data; acesso passa a ser via jump host (vm-fend).
```

**Princípios de design (e o que isso ensina):**

- 🧅 **Defesa em profundidade (alvo final).** Frontend e backend rodam na **porta 80** (a API também — para facilitar a futura migração para Web App). O frontend é o único que aceita `80/443` da **Internet**; o backend só aceita `80` **de dentro da VNet** (graças ao `Destination` da NSG); o banco só aceita `1433` da **VNet do app** (`10.20.0.0/16`), que chega via **peering**. Na **Fase 8** você ainda remove os IPs públicos de back/data. **3 camadas, cada uma protegendo a próxima.**
- 🔗 **VNet peering entre regiões.** As VMs ficam em **duas regiões** (Central India e Australia East — limite de 4 vCPU/região) e as VNets são ligadas por **peering global**. Você aprende como duas redes isoladas passam a se enxergar pelos IPs privados.
- 🧮 **Uma NSG por VNet, servindo as subnets.** Em vez de uma NSG por NIC, usamos **2 NSGs associadas a subnets**: `nsg-prd-inf-cin-001` cobre as duas subnets de app, `nsg-prd-inf-aes-001` cobre a subnet de banco. Menos objetos para gerenciar — padrão comum em ambientes reais.
- 🔁 **Sem CORS em produção.** O navegador chama `/api/*` na **mesma origem** do frontend; o `web.config` faz o *reverse proxy* via ARR para o backend (`http://<IP_BEND>/api/...`, porta 80). Você aprende o padrão *proxy reverso* na sua versão "raiz" — direto no IIS.
- 🗃️ **Migração de dados real.** O banco não nasce vazio: você **importa um `.bacpac`** via SSMS na `vm-data` — exatamente como se faz ao mover um sistema legado para a nuvem.
- 🧗 **Jump host (no final).** Depois que tudo funciona, você remove o IP público de `vm-bend` e `vm-data` e passa a administrá-las **através** da `vm-fend` (RDP → IP privado). É como o pessoal de SRE faz **há décadas** — e você sente por que se faz assim.

### 🛡️ NSG Matrix

**Durante o lab** (todas as VMs com IP público — foco em "fazer funcionar"):

| NSG (subnets) | Inbound permitido |
|---|---|
| `nsg-prd-inf-cin-001` (fend + bend) | TCP 80,443 da **Internet** → **destino só `10.20.1.0/24`** (front); TCP 3389 (apenas o **seu IP**, p/ RDP); TCP 80 com origem `10.20.0.0/16` → **destino só `10.20.2.0/24`** (back, via proxy do front) |
| `nsg-prd-inf-aes-001` (data) | TCP 1433 (origem `10.20.0.0/16` = VNet do app, via peering); TCP 3389 (apenas o **seu IP**, p/ RDP) |

**Após o hardening (Fase 8)** — IP público só na `vm-fend`:

| NSG (subnets) | Muda para |
|---|---|
| `nsg-prd-inf-cin-001` | RDP (3389) do backend passa a vir **só da subnet do front** (jump host); frontend mantém 80/443 da Internet |
| `nsg-prd-inf-aes-001` | RDP (3389) passa a vir **só da VNet do app** (jump host); 1433 continua só de `10.20.0.0/16` |

---

## 🧭 5. A jornada do aluno

| Fase | Etapa | Tempo aprox. |
|---|---|---|
| **Fase 0** | Pré-requisitos | 10 min |
| **Fase 1** | Desenho de arquitetura — definir regiões, VNets/subnets e taxonomia | 20 min |
| **Fase 2** | Provisionar a rede (2 VNets + subnets + peering + 2 NSGs) e as 3 VMs (com IP público) | 35 min |
| **Fase 3** | Autenticação SQL na `vm-data` (imagem pronta) + restore do bacpac | 15 min |
| **Fase 4** | IIS+iisnode+Node na `vm-bend` + deploy do `fifa2026-api.zip` | 15 min |
| **Fase 5** | IIS+ARR na `vm-fend` + deploy do `fifa2026-web.zip` | 10 min |
| **Fase 6** | Domínio (DNS público) + certificado wildcard HTTPS | 20 min |
| **Fase 7** | Smoke test ponta a ponta | 10 min |
| **Fase 8** | Hardening final: remover IP público de `vm-bend`/`vm-data` + jump host | 15 min |
| **Fase 9** | Troubleshooting + **desligar/apagar VMs** | livre |

> 🧩 **Como o código chega até você (sem fork!):** **nesta etapa não há fork de repositório.** Você baixa **dois ZIPs já prontos** por **link direto no Blob Storage** — `fifa2026-api.zip` na `vm-bend` (Fase 4) e `fifa2026-web.zip` na `vm-fend` (Fase 5) — e o banco (`.bacpac`) também por link direto (Fase 3). Tudo vem **compilado**: o frontend já buildado e as dependências do backend (`node_modules`) já incluídas. **Você não compila nada** — só configura. A única coisa que o instrutor compartilha é **o link deste guia**. _(Instrutor: os ZIPs e o bacpac são gerados via [`PACOTE-ALUNOS.md`](PACOTE-ALUNOS.md) e publicados no Blob Storage.)_

> 🧠 **Total esperado:** ~1h30 de mão na massa + tempo de download/instalação. Reserve **2h30 cheias** na primeira execução.

---

### Fase 0 — Pré-requisitos

- [ ] **Conta Azure ativa** — [azure.microsoft.com/free](https://azure.microsoft.com/free/)
- [ ] **Cliente RDP**:
  - **Windows:** já vem com `mstsc` (Conexão de Área de Trabalho Remota) — busque "Remote Desktop Connection" no menu Iniciar
  - **macOS:** instale **Microsoft Remote Desktop** na Mac App Store
  - **Linux:** instale **Remmina** (`sudo apt install remmina remmina-plugin-rdp`)
- [ ] **Navegador moderno** (para o Portal e para testar o app no fim)
- [ ] **Bloco de notas** para anotar: IPs públicos das 3 VMs (e os privados), credenciais de autenticação SQL (`adminsql`), senha de admin do Windows Server, JWT_SECRET
- [ ] _(Opcional — só para a Fase 6, HTTPS)_ **Um domínio próprio com zona DNS pública.** Não tem um? Veja a nota da Fase 6 (recomendamos registrar um domínio barato na **Hostinger**). Sem domínio, você ainda conclui o app em HTTP — a Fase 6 é a etapa "extra" de TLS.

**Confirme o Azure:** entre em [portal.azure.com](https://portal.azure.com) → topo direito → **Subscription** ativa.

**Alerta de orçamento (essencial neste cenário):** Portal → **Cost Management → Budgets → + Add** → **$30/mês**, alerta em 80% e 100% → seu e-mail.

> ⚠️ **Por que o alerta é crítico aqui?** Três VMs ligadas 24/7 custam **~$90/mês**. **Sempre desligue ao final da sessão** (`deallocate`, Fase 9) — desligada, cada VM cai para ~$5/mês (só o disco).

> ✅ **Pronto quando:** você abre o Portal, vê uma subscription ativa, e seu cliente RDP abre sem erro.

---

### Fase 1 — Desenho de arquitetura

> 🧠 **Antes de clicar em "Create", a gente desenha.** Esta é a fase mais importante e a que mais ensina: **definir o ambiente no papel** antes de provisionar. O instrutor **apresenta a arquitetura de referência**, mostra os detalhes, e **debatemos juntos** as redes, regiões e nomes que vamos usar. O que sair daqui vira a "planta" que você executa nas Fases 2+.

**Não há fork de repositório nesta etapa.** Todo o código (`fifa2026-api.zip`, `fifa2026-web.zip`) e o banco (`.bacpac`) chegam por **link direto no Blob Storage**, nas fases em que são usados. A única coisa que você recebe do instrutor é **o link deste guia**.

#### 1.1 O que vamos desenhar

Uma topologia de **3 VMs** em **2 regiões**, ligadas por **peering global**:

- **Aplicação** (Central India) → VNet `10.20.0.0/16` com **duas subnets**: uma para o frontend e uma para o backend.
- **Banco** (Australia East) → VNet `10.30.0.0/16` com **uma subnet** para o banco.
- **Por que duas regiões?** O limite de **4 vCPU/região** (subscriptions Free/Sponsorship) não comporta 3× B2s = 6 vCPU numa região só. Distribuir em duas regiões + peering é a solução real (e um ótimo aprendizado).

#### 1.2 Taxonomia de nomes (padrão do evento)

Todos os recursos seguem o padrão `<tipo>-<ambiente>-<carga>-<região>-<instância>`. **Use exatamente estes nomes** nas próximas fases:

| Recurso | Nome | Região | Faixa / Observação |
|---|---|---|---|
| Resource Group | `rg-prd-tik-cin-001` | Central India | contém recursos das **duas** regiões |
| VNet de aplicação | `vnet-prd-inf-cin-001` | Central India | `10.20.0.0/16` |
| ↳ Subnet frontend | `snet-prd-inf-fend-cin-001` | — | `10.20.1.0/24` |
| ↳ Subnet backend | `snet-prd-inf-bend-cin-001` | — | `10.20.2.0/24` |
| VNet de banco | `vnet-prd-inf-aes-001` | Australia East | `10.30.0.0/16` |
| ↳ Subnet de banco | `snet-prd-inf-data-aes-001` | — | `10.30.1.0/24` |
| NSG de aplicação | `nsg-prd-inf-cin-001` | Central India | **uma só**, associada às 2 subnets de app |
| NSG de banco | `nsg-prd-inf-aes-001` | Australia East | associada à subnet de banco |
| VM frontend (`vm-fend`) | `vm-prd-tk-fend-cin-001` | Central India | subnet frontend |
| VM backend (`vm-bend`) | `vm-prd-tk-bend-cin-001` | Central India | subnet backend |
| VM banco (`vm-data`) | `vm-prd-tk-data-aes-001` | Australia East | subnet de banco · imagem SQL Server 2022 |

#### 1.3 Decisões de rede e segurança que combinamos

- **2 NSGs, associadas a subnets** (não a NICs): uma cobre as duas subnets de app, outra cobre a de banco. Menos objetos para gerenciar.
- **Peering global** entre `vnet-prd-inf-cin-001` e `vnet-prd-inf-aes-001` — sem ele, backend e banco não se enxergam (e você veria `ETIMEOUT` na porta 1433).
- **IP público em todas as VMs no começo.** Faz o setup fluir (RDP direto em cada VM). **No final (Fase 8)**, com tudo funcionando, removemos o IP público de `vm-bend` e `vm-data` e migramos para **jump host** via `vm-fend`. Filosofia: *primeiro funciona, depois tranca*.

> 💬 **Momento de debate:** este é o desenho de referência. No evento, discutimos alternativas (uma região vs duas, NSG por NIC vs por subnet, IPs públicos desde o início vs jump host imediato) e **fechamos a planta** antes de provisionar. Ajuste os nomes/faixas com o instrutor se o seu cenário pedir.

> ✅ **Pronto quando:** você tem a **planta fechada** — regiões, VNets/subnets, faixas de IP e a tabela de nomes acima — e entende *por que* cada escolha foi feita.

---

### Fase 2 — Provisionar a rede e as VMs

Tudo em [portal.azure.com](https://portal.azure.com), seguindo a **planta da Fase 1**. Use a **barra de busca** no topo, abra o serviço, **+ Create**, e finalize em **Review + create → Create**.

> 🌐 **Lembrete:** nesta fase as **3 VMs sobem com IP público** — o jump host e a remoção dos IPs ficam para a **Fase 8**.

#### Passo 0 — Resource Group

1. Busca → **Resource groups** → **+ Create**
2. **Subscription:** a sua · **Resource group:** `rg-prd-tik-cin-001` · **Region:** **Central India**
3. **Review + create** → **Create**

📋 **Anote:** um RG pode conter recursos de **várias regiões** — então usamos **um** RG (`rg-prd-tik-cin-001`) para tudo, mesmo com VMs em Central India **e** Australia East.

---

#### Passo 1 — VNet de aplicação `vnet-prd-inf-cin-001` (Central India) + 2 subnets

1. Busca → **Virtual networks** → **+ Create**
2. **Resource group:** `rg-prd-tik-cin-001` · **Name:** `vnet-prd-inf-cin-001` · **Region:** **Central India**
3. Aba **IP addresses** → **IPv4 address space:** `10.20.0.0/16`
4. **Remova** a subnet `default` e **crie duas** (+ Add subnet):
   - **Name:** `snet-prd-inf-fend-cin-001` · **Subnet address range:** `10.20.1.0/24` ← (frontend)
   - **Name:** `snet-prd-inf-bend-cin-001` · **Subnet address range:** `10.20.2.0/24` ← (backend)
5. **Review + create** → **Create**

---

#### Passo 2 — VNet de banco `vnet-prd-inf-aes-001` (Australia East) + 1 subnet

1. Busca → **Virtual networks** → **+ Create**
2. **Resource group:** `rg-prd-tik-cin-001` · **Name:** `vnet-prd-inf-aes-001` · **Region:** **Australia East** ← (região **diferente**, para ter os 2 vCPU da `vm-data`)
3. Aba **IP addresses** → **IPv4 address space:** `10.30.0.0/16` ← **não pode sobrepor** o `10.20.0.0/16`
4. **Remova** a `default` e crie a subnet de banco:
   - **Name:** `snet-prd-inf-data-aes-001` · **Subnet address range:** `10.30.1.0/24`
5. **Review + create** → **Create**

> ⚠️ **CIDRs não podem se sobrepor.** Peering exige faixas distintas — por isso `10.20.x` (app) e `10.30.x` (banco). Se as duas usassem `10.0.0.0/16`, o peering falharia.

---

#### Passo 3 — Conectar as VNets (VNet Peering global)

1. Abra `vnet-prd-inf-cin-001` → menu **Peerings** → **+ Add**
2. **This virtual network → Peering link name:** `app-to-db`
3. **Remote virtual network → Peering link name:** `db-to-app`
4. **Virtual network:** selecione `vnet-prd-inf-aes-001`
5. Deixe **Allow** o tráfego habilitado nos dois sentidos (padrão)
6. **Add** → o Portal cria **os dois lados** de uma vez

📋 **Confirme:** em ambas as VNets, menu **Peerings** → status **Connected**.

> 💡 **O que o peering faz?** Sem ele, duas VNets são ilhas — a `vm-bend` manda pacote para o IP da `vm-data` e ninguém roteia (é exatamente o `ETIMEOUT` "Failed to connect to ...:1433"). Com peering, os IPs privados das duas regiões passam a se enxergar como se fossem a mesma rede.

---

#### Passo 4 — NSG de aplicação `nsg-prd-inf-cin-001` (associada às 2 subnets de app)

> 🌐 **Descubra o seu IP público** (para liberar só o seu RDP): abra [ifconfig.me](https://ifconfig.me) ou [whatismyip.com](https://www.whatismyip.com) e anote (rótulo: *MEU_IP*).

1. Busca → **Network security groups** → **+ Create**
2. **RG:** `rg-prd-tik-cin-001` · **Name:** `nsg-prd-inf-cin-001` · **Region:** **Central India** → **Create**
3. Abra `nsg-prd-inf-cin-001` → **Inbound security rules** → **+ Add** (uma de cada):
   - `allow-http-https-front`: Source **Service Tag → Internet** · **Destination IP `10.20.1.0/24`** (só a subnet do front) · Destination ports `80,443` · TCP · Allow · Priority 100
   - `allow-rdp-meu-ip`: Source **IP Addresses → `MEU_IP`** · Destination port `3389` · TCP · Allow · Priority 110
   - `allow-api-from-vnet`: Source **IP Addresses → `10.20.0.0/16`** · **Destination IP `10.20.2.0/24`** (só a subnet do back) · Destination port `80` · TCP · Allow · Priority 120
4. **Associate às DUAS subnets:** dentro do NSG → **Subnets** → **+ Associate** → escolha `vnet-prd-inf-cin-001` / `snet-prd-inf-fend-cin-001`; repita o **+ Associate** para `snet-prd-inf-bend-cin-001`.

> 🎯 **Por que a `Destination` importa aqui?** Tanto o frontend quanto o backend **rodam na porta 80** (escolhemos 80 no backend para facilitar a futura migração para Web App — veja a Fase 4.8). Como **uma só NSG** cobre as duas subnets, usamos o campo **Destination** para separar: a porta 80 da **Internet** só alcança a subnet do **front** (`10.20.1.0/24`); a porta 80 do **backend** (`10.20.2.0/24`) só aceita origem **de dentro da VNet** (`10.20.0.0/16`, ou seja, o proxy do front). Resultado: mesmo com IP público, a API **não responde direto pela Internet**.

---

#### Passo 5 — NSG de banco `nsg-prd-inf-aes-001` (associada à subnet de banco)

1. **+ Create** → **Name:** `nsg-prd-inf-aes-001` · **Region:** **Australia East** ← (mesma região da `vm-data`)
2. **Inbound security rules** → **+ Add**:
   - `allow-sql-from-app`: Source **IP Addresses → `10.20.0.0/16`** (VNet do app, via peering) · port `1433` · TCP · Allow · Priority 100
   - `allow-rdp-meu-ip`: Source **IP Addresses → `MEU_IP`** · port `3389` · TCP · Allow · Priority 110
3. **Associate** → **Subnets** → **+ Associate** → `vnet-prd-inf-aes-001` / `snet-prd-inf-data-aes-001`.

> 💡 **Por que `10.20.0.0/16` na `nsg-prd-inf-aes-001`?** A `vm-bend` está em **outra VNet/região**; o tráfego dela chega pela faixa `10.20.x` através do **peering**. Por isso a origem do `1433` é a VNet do app — não `10.30.x`. Se puser `10.30.0.0/24`, a `vm-bend` não passa e volta o `ETIMEOUT`.

---

#### Passo 6 — `vm-prd-tk-fend-cin-001` (frontend) · Central India

1. Busca → **Virtual machines** → **+ Create** → **Azure virtual machine**
2. **Resource group:** `rg-prd-tik-cin-001` · **Virtual machine name:** `vm-prd-tk-fend-cin-001`
3. **Region:** **Central India** · **Image:** **Windows Server 2022 Datacenter: Azure Edition** (Gen2) · **Size:** **Standard_B2s**
4. **Administrator account → Username:** `tftecadmin` · **Password:** crie uma forte e 📋 **anote** (rótulo: *VM Admin Password*)
5. **Public inbound ports:** **None** ← (as portas já estão na NSG da subnet; o IP público vem no próximo passo)
6. Aba **Networking:** **Virtual network:** `vnet-prd-inf-cin-001` · **Subnet:** `snet-prd-inf-fend-cin-001` · **Public IP:** _(criar novo, padrão)_ · **NIC network security group:** **None** ← (quem protege é a NSG da subnet)
7. **Review + create** → **Create**

📋 **Após criar:** `vm-prd-tk-fend-cin-001` → **Overview** → anote o **Public IP** (rótulo: *IP_FRONT*) e o **Private IP** (rótulo: *IP_FRONT_PRIVADO* — `10.20.1.x`).

---

#### Passo 7 — `vm-prd-tk-bend-cin-001` (backend) · Central India

Repita o Passo 6, mudando:
- **Virtual machine name:** `vm-prd-tk-bend-cin-001`
- **Subnet:** `snet-prd-inf-bend-cin-001`
- mesmo admin `tftecadmin` · **Public IP:** _(criar novo)_ · **NIC NSG:** **None**

📋 **Após criar:** anote o **Public IP** (rótulo: *IP_BEND_PUB* — só para RDP) e o **Private IP** (rótulo: *IP_BACK* — `10.20.2.x`, vai no `web.config`).

---

#### Passo 8 — `vm-prd-tk-data-aes-001` (banco, imagem SQL Server 2022) · Australia East

Aqui muda uma coisa importante: em vez da imagem "limpa" de Windows Server, usamos uma imagem do Marketplace que **já vem com o SQL Server 2022 instalado**. Você **não instala nada** — só ativa a autenticação SQL num passo do próprio wizard.

1. Busca → **Virtual machines** → **+ Create** → **Azure virtual machine**
2. **Resource group:** `rg-prd-tik-cin-001` · **Virtual machine name:** `vm-prd-tk-data-aes-001`
3. **Region:** **Australia East** ← (a **mesma** região da `vnet-prd-inf-aes-001`)
4. **Image:** **See all images** → busque **`SQL Server 2022`** → **SQL Server 2022 Developer on Windows Server 2022** (Developer é gratuita) · **Size:** **Standard_B2s**
5. **Administrator account → Username:** `adminsql` · **Password:** `Partiunuvem@2026` → 📋 **anote** (rótulo: *SQL/VM adminsql*)
6. **Public inbound ports:** **None**
7. Aba **Networking:** **Virtual network:** `vnet-prd-inf-aes-001` · **Subnet:** `snet-prd-inf-data-aes-001` · **Public IP:** _(criar novo)_ · **NIC NSG:** **None**
8. Aba **SQL Server settings** (só aparece porque a imagem tem SQL):
   - **SQL connectivity:** **Private (within Virtual Network)** · **Port:** `1433`
     > 💡 Escolher **Private** já manda a imagem **habilitar o TCP/IP do SQL e liberar a porta 1433 no firewall do Windows automaticamente** — por isso você não roda mais aqueles passos à mão.
   - **SQL Authentication:** **Enable** → **Login name:** `adminsql` · **Password:** `Partiunuvem@2026`
     > 💡 Em algumas versões do wizard o **Login name** já vem preenchido com o usuário admin do Windows e fica somente-leitura. Como definimos o admin do Windows como **`adminsql`** no item 5 acima, o login SQL fica `adminsql` de qualquer forma. _(As outras duas VMs usam `tftecadmin`; só a `vm-data` usa `adminsql`.)_
9. **Review + create** → **Create**

> 🔐 **Por que `adminsql` e não criar um login separado?** A imagem já entrega o SQL com autenticação SQL configurada no wizard, então a aplicação se conecta **direto** com `adminsql` / `Partiunuvem@2026`. **Não há mais o passo manual de `CREATE LOGIN`.** (Em produção real você usaria um login de aplicação com permissão mínima + Key Vault; aqui priorizamos simplicidade didática.)

📋 **Após criar:** anote o **Public IP** (rótulo: *IP_DATA_PUB* — só para RDP) e o **Private IP** (rótulo: *IP_DB* — `10.30.1.x`, vai no `.env`).

---

#### ✅ Checklist da Fase 2

No `rg-prd-tik-cin-001` você deve ver (recursos em **duas regiões**):

```
rg-prd-tik-cin-001
├── vnet-prd-inf-cin-001   (10.20.0.0/16, Central India)   ──peering──┐
│     ├── snet-prd-inf-fend-cin-001 (10.20.1.0/24)                     │
│     └── snet-prd-inf-bend-cin-001 (10.20.2.0/24)                     │
├── vnet-prd-inf-aes-001   (10.30.0.0/16, Australia East) ◀───────────┘
│     └── snet-prd-inf-data-aes-001 (10.30.1.0/24)
├── nsg-prd-inf-cin-001    (Central India, associada às 2 subnets de app)
├── nsg-prd-inf-aes-001    (Australia East, associada à subnet de banco)
├── vm-prd-tk-fend-cin-001 (Central India,   B2s, IP público) + NIC + Disk
├── vm-prd-tk-bend-cin-001 (Central India,   B2s, IP público) + NIC + Disk
└── vm-prd-tk-data-aes-001 (Australia East,  B2s, IP público, imagem SQL Server 2022) + NIC + Disk
```

Anotado no bloco: *VM Admin Password* (`tftecadmin`, fend+bend), *SQL/VM adminsql* (`adminsql` / `Partiunuvem@2026`, vm-data), *MEU_IP*, *IP_FRONT*, *IP_FRONT_PRIVADO*, *IP_BEND_PUB*, *IP_BACK* (`10.20.2.x`), *IP_DATA_PUB*, *IP_DB* (`10.30.1.x`).

> ✅ **Pronto quando:** as 3 VMs aparecem como **Running** (cada uma com IP público), as 2 NSGs estão **associadas às subnets**, **e o peering das duas VNets está `Connected`**.

---

### Fase 3 — Configurar a `vm-data` (SQL Server + bacpac)

> 🧩 **Sem instalação.** A `vm-data` foi criada a partir da imagem **SQL Server 2022 Developer on Windows Server 2022** (Fase 2, passo 8), então o SQL Server **já está instalado, rodando e com autenticação SQL habilitada** (`adminsql`). Nesta fase você só **confirma** que está tudo no ar e **restaura o banco** a partir do `.bacpac`. **Não há instalação de SQL Server, Mixed Mode manual, nem `CREATE LOGIN`** — a imagem já entregou isso pronto.

#### 3.1 Conectar via RDP

1. Abra seu cliente RDP e conecte **direto** ao **`IP_DATA_PUB`** (IP público da `vm-data`, anotado na Fase 2).
2. Login **`adminsql`** + senha **`Partiunuvem@2026`** ← (a `vm-data` usa o admin `adminsql`, não `tftecadmin`).

> 💡 **RDP direto agora; jump host depois.** Nesta etapa a `vm-data` tem IP público e a NSG libera o `3389` **só do seu IP** (`MEU_IP`), então você entra direto. Na **Fase 8** removemos o IP público e o acesso passa a ser via jump host pela `vm-fend`.

#### 3.2 Confirmar que o SQL Server está no ar (imagem pronta)

Já dentro da `vm-data`, valide rapidamente o que a imagem já configurou:

1. Abra o **SQL Server 2022 Configuration Manager** (busca no Windows) → **SQL Server Services** → **SQL Server (MSSQLSERVER)** deve estar **Running**.
2. (Opcional) Confirme o TCP/IP: **SQL Server Network Configuration → Protocols for MSSQLSERVER → TCP/IP** já deve estar **Enabled** (a opção *Private* do wizard ligou isso por você).

> ✅ Como você escolheu **SQL connectivity = Private** + **Port 1433** no wizard (Fase 2), o **TCP/IP do SQL** e a **regra de firewall da porta 1433** já vêm prontos. Se por algum motivo a conexão da `vm-bend` falhar mais tarde, a Fase 9 tem o passo manual de fallback (`New-NetFirewallRule` 1433 + Enable TCP/IP).

#### 3.3 Restaurar o `.bacpac`

1. **Baixar SSMS** (SQL Server Management Studio) na `vm-data`: [aka.ms/ssmsfullsetup](https://aka.ms/ssmsfullsetup) → instalar (5-10 min). _(A imagem traz o SQL Server, mas não necessariamente o SSMS.)_
2. Abra **SSMS** → Connect: **Server name:** `localhost` · **Authentication:** **SQL Server Authentication** · **Login:** `adminsql` · **Password:** `Partiunuvem@2026` → **Connect**
3. **Baixe o `.bacpac` direto na `vm-data`** pelo link do Blob Storage (sem fork, sem copiar do seu PC): **`https://stotfteccopaazure.blob.core.windows.net/copa2026/FIFA2026Tickets.bacpac`** → salve em `C:\`.
   > ⚠️ **Use sempre o link acima** (atualizado pela organização antes do evento). Um `.bacpac` antigo sobe o app com dados desatualizados (ex.: 12 jogos em vez de 104).
4. **Object Explorer** → botão direito em **Databases** → **Import Data-tier Application...**
5. **Next** → **Browse** → selecione o `FIFA2026Tickets.bacpac` que você baixou
6. **Database name:** `FIFA2026Tickets` → **Next** → **Next** → **Finish**
7. Aguarde ~1-3 min (depende do tamanho)

📋 **Para o `.env` da Fase 4 use as credenciais do wizard:** *DB_USER* = `adminsql` · *DB_PASSWORD* = `Partiunuvem@2026`.

> ✅ **Pronto quando:** no SSMS, `SELECT COUNT(*) FROM matches;` retorna **104** (e `SELECT COUNT(*) FROM stadiums;` retorna **17**, `SELECT COUNT(*) FROM teams;` retorna **49**).

---

### Fase 4 — Configurar a `vm-bend` (backend Node)

#### 4.1 Conectar via RDP

RDP **direto** ao **`IP_BEND_PUB`** (IP público da `vm-bend`), user `tftecadmin`, senha anotada. _(A NSG libera o `3389` só do seu `MEU_IP`. O IP público sai na Fase 8.)_

#### 4.2 Instalar IIS + recursos

PowerShell **como Administrador** na `vm-bend`:

```powershell
# Instalar IIS
Install-WindowsFeature -Name Web-Server -IncludeManagementTools

# Recursos adicionais (Story 1.1 + DEPLOY_IIS_SIMPLIFICADO.md)
Install-WindowsFeature -Name Web-WebSockets
Install-WindowsFeature -Name Web-Stat-Compression
Install-WindowsFeature -Name Web-Dyn-Compression

Write-Host "OK IIS instalado" -ForegroundColor Green
```

#### 4.3 Instalar Node.js e iisnode

Ainda no navegador da `vm-bend`:

1. **Node.js LTS** (18 ou 20): [nodejs.org](https://nodejs.org/en/download) → baixe e instale (Windows Installer x64)
2. **iisnode** (versão **Full**): [github.com/Azure/iisnode/releases](https://github.com/Azure/iisnode/releases) → baixe `iisnode-full-v0.2.26-x64.msi` → instale
3. **URL Rewrite Module**: [iis.net/downloads/microsoft/url-rewrite](https://www.iis.net/downloads/microsoft/url-rewrite) → instale

**Depois de instalar, destrave as seções `handlers` e `modules`** no nível do servidor. Sem isso, o `web.config` da API (que registra o handler do iisnode) é rejeitado com **HTTP 500.19** (`0x80070021` — _"section is locked at a parent level"_). PowerShell **como Administrador**:

```powershell
& "$env:windir\system32\inetsrv\appcmd.exe" unlock config -section:system.webServer/handlers
& "$env:windir\system32\inetsrv\appcmd.exe" unlock config -section:system.webServer/modules
iisreset
```

> 💡 **Por quê?** Por padrão o IIS não delega a edição dessas seções para o `web.config` de uma aplicação. Como o `web.config` da API precisa adicionar o handler `iisnode`, a delegação tem que estar liberada (equivale a **IIS Manager → nó do servidor → Feature Delegation → `Handler Mappings` e `Modules` → Read/Write**).

#### 4.4 Baixar a aplicação (já compilada)

Baixe o ZIP **pronto** do backend direto na `vm-bend`:

```
https://stotfteccopaazure.blob.core.windows.net/copa2026/fifa2026-api.zip
```

Extraia para `C:\inetpub\wwwroot\` — vai aparecer a pasta `fifa2026-api/` já com `src/`, `web.config`, `.env.example` **e a pasta `node_modules/` (dependências de produção já instaladas)**.

#### 4.5 Configurar `.env` da API

> ⚠️ **O arquivo precisa se chamar EXATAMENTE `.env`** — não `.env.txt`, não `fifaapi.env`. O dotenv só lê `.env`; com qualquer outro nome a API sobe mas falha ao consultar o banco (`config.server undefined`). O Bloco de Notas erra isso com frequência, então **crie via PowerShell** (nome e encoding garantidos). Troque `<IP_DB>`, a senha e o `JWT_SECRET` pelos seus valores e cole na `vm-bend`:

```powershell
cd C:\inetpub\wwwroot\fifa2026-api
'DB_SERVER=<IP_DB>'          | Set-Content .env -Encoding ascii
'DB_PORT=1433'               | Add-Content .env
'DB_USER=adminsql'           | Add-Content .env
'DB_PASSWORD=Partiunuvem@2026' | Add-Content .env
'DB_NAME=FIFA2026Tickets'    | Add-Content .env
'PORT=80'                  | Add-Content .env
'HOST=0.0.0.0'             | Add-Content .env
'JWT_SECRET=troque-por-uma-string-longa-aleatoria' | Add-Content .env
'JWT_EXPIRES_IN=7d'        | Add-Content .env
'FRONTEND_URL=*'           | Add-Content .env
```

- `<IP_DB>` = IP privado da vm-data (anotado na Fase 2).
- `DB_USER`/`DB_PASSWORD` = **exatamente** as credenciais de autenticação SQL definidas no wizard da `vm-data` (`adminsql` / `Partiunuvem@2026`).
- `FRONTEND_URL=*` libera o CORS — no proxy reverso o CORS nem é exercitado; pode trocar pelo IP do front depois.

**Confirme** o nome e o conteúdo (deve listar `.env`, não `.env.txt`):

```powershell
Get-ChildItem .env | Select-Object Name, Length
Get-Content .env | Select-String '^DB_(SERVER|USER|NAME)='
```

> 💡 **Por que `HOST=0.0.0.0`?** Sem isso, Node escuta só em `localhost`, e a vm-fend não consegue alcançar pelo IP privado. Com `0.0.0.0` aceita conexões de toda a VNet.

#### 4.6 Dependências do Node — já incluídas (nada a instalar)

O `fifa2026-api.zip` **já traz a pasta `node_modules/`** instalada (dependências de produção). **Você NÃO precisa rodar `npm install`** — pule direto para o próximo passo.

> 💡 **Por que já vem pronto?** O backend é JavaScript puro (sem etapa de compilação) e as dependências (`express`, `mssql`, `bcryptjs`…) não têm módulos nativos — então a `node_modules` empacotada funciona em qualquer Windows. Isso evita o download de centenas de pacotes dentro da VM.

#### 4.7 Permissões na pasta

```powershell
$acl = Get-Acl "C:\inetpub\wwwroot\fifa2026-api"
$rule = New-Object System.Security.AccessControl.FileSystemAccessRule("IIS_IUSRS", "FullControl", "ContainerInherit,ObjectInherit", "None", "Allow")
$acl.SetAccessRule($rule)
Set-Acl "C:\inetpub\wwwroot\fifa2026-api" $acl
```

#### 4.8 Criar site no IIS (porta 80)

> 🚀 **Por que a API na porta 80?** Um **Web App (App Service)** serve sua aplicação em **80/443** por padrão — não dá para escolher uma porta arbitrária como 3001. Rodando a API em **80** já neste cenário VM, o dia em que você **modernizar para Web App** a configuração praticamente não muda (sem `PORT` customizado, sem reescrever proxy para outra porta). É o mesmo app, pronto para os dois mundos.

1. **Pare o site padrão (ele ocupa a porta 80):** IIS Manager → **Sites → Default Web Site → Stop** (painel direito), ou delete.
2. Busca → **IIS Manager** → painel esquerdo → expanda o servidor → botão direito em **Sites** → **Add Website**
3. Preencha:
   - **Site name:** `FIFA2026-API`
   - **Physical path:** `C:\inetpub\wwwroot\fifa2026-api`
   - **Binding type:** http · **IP address:** All Unassigned · **Port:** `80` · **Host name:** _(vazio)_
4. **OK**
5. **Application Pools** → encontre `FIFA2026-API` → botão direito → **Advanced Settings** → **.NET CLR Version:** `No Managed Code` → **OK**

#### 4.9 Smoke local na `vm-bend`

PowerShell:

```powershell
Invoke-RestMethod -Uri "http://localhost/api/health"
Invoke-RestMethod -Uri "http://localhost/api/matches" | Select-Object -ExpandProperty matches | Measure-Object | Select-Object Count
# Deve retornar Count = 104
```

> ✅ **Pronto quando:** `/api/health` responde OK e `/api/matches` retorna 104.

---

### Fase 5 — Configurar a `vm-fend` (frontend + proxy reverso)

> 🧩 **Sem build.** O frontend já vem **compilado** dentro do `fifa2026-web.zip` (HTML/JS/CSS prontos). Você não precisa de Node nem do código-fonte aqui — só publica os arquivos e aponta o proxy para a `vm-bend`.

#### 5.1 Conectar via RDP

RDP **direto** ao **`IP_FRONT`** (IP público da `vm-fend`), user `tftecadmin`. _(Este IP público é o do app — a `vm-fend` continua pública mesmo após a Fase 8.)_

#### 5.2 Instalar IIS + URL Rewrite + ARR

PowerShell **como Administrador** na `vm-fend`:

```powershell
Install-WindowsFeature -Name Web-Server -IncludeManagementTools
Install-WindowsFeature -Name Web-WebSockets
Install-WindowsFeature -Name Web-Stat-Compression
Install-WindowsFeature -Name Web-Dyn-Compression
```

No navegador da `vm-fend`:
- [URL Rewrite Module](https://www.iis.net/downloads/microsoft/url-rewrite) → instale
- [Application Request Routing (ARR)](https://www.iis.net/downloads/microsoft/application-request-routing) → instale

#### 5.3 Habilitar proxy no ARR

1. **IIS Manager** → clique no nome do servidor (raiz da árvore)
2. Painel central → duplo clique em **Application Request Routing Cache**
3. Painel direito → **Server Proxy Settings...**
4. ✅ Marque **Enable proxy** → **Apply**

> ⚠️ **Não pule este passo.** Sem `Enable proxy`, o `web.config` do frontend tenta fazer rewrite e o IIS retorna 502. Esse é o erro nº 1 do cenário VM.

#### 5.4 Baixar o frontend e apontar para o backend

1. Baixe o ZIP **pronto** do frontend direto na `vm-fend`:
   ```
   https://stotfteccopaazure.blob.core.windows.net/copa2026/fifa2026-web.zip
   ```
2. Extraia para `C:\inetpub\wwwroot\` — vai aparecer a pasta `fifa2026-web/` com `index.html` + `assets/` + `web.config`.
3. **A única edição do frontend:** o `web.config` vem com o placeholder `__BACKEND_URL__`. Troque-o pelo IP privado da `vm-bend`. PowerShell na `vm-fend`:
   ```powershell
   cd C:\inetpub\wwwroot\fifa2026-web
   (Get-Content web.config) -replace '__BACKEND_URL__','http://<IP_BACK>' | Set-Content web.config
   ```
   _(troque `<IP_BACK>` pelo IP privado real da vm-bend, anotado na Fase 2 — ex.: `http://10.20.2.4`. A porta é 80, então não precisa especificar.)_
4. **Confirme** a substituição:
   ```powershell
   Select-String -Path web.config -Pattern '__BACKEND_URL__'   # NÃO deve retornar nada
   Select-String -Path web.config -Pattern 'Rewrite url'        # deve mostrar o seu IP
   ```

> 💡 **Por que não precisa recompilar?** O endereço do backend **não** está embutido no JavaScript — o código chama sempre `/api` (relativo), e é o `web.config` (proxy do IIS) que decide para onde `/api/*` vai. Por isso o **mesmo** `fifa2026-web.zip` serve para qualquer aluno: cada um só troca essa linha.

#### 5.5 Criar site no IIS (porta 80)

1. **IIS Manager** → botão direito em **Sites** → **Add Website**
2. **Site name:** `FIFA2026-Web` · **Physical path:** `C:\inetpub\wwwroot\fifa2026-web` · **Binding:** http, port `80`
3. **OK**
4. **Application Pools** → `FIFA2026-Web` → **Advanced Settings** → `.NET CLR Version` = `No Managed Code`

> ⚠️ **Conflito de porta:** o site **Default Web Site** que vem com o IIS já ocupa a porta 80. Pare ele: **Sites → Default Web Site → Stop** (painel direito), ou delete.

> ✅ **Pronto quando:** abrindo o navegador da `vm-fend` em `http://localhost`, o site FIFA 2026 carrega.

---

### Fase 6 — Domínio (DNS) + certificado wildcard HTTPS

> 🧠 **Etapa "extra" (mas muito real).** Até aqui o app responde em **HTTP** pelo IP público. Agora você vai dar a ele um **domínio próprio** e um **certificado TLS válido na Internet** — emitido **de graça** pelo Let's Encrypt e instalado **com as suas mãos** no IIS da `vm-fend`. Em VM, o TLS é responsabilidade sua — e aqui você vê o mecanismo por dentro, do desafio DNS ao binding HTTPS.
>
> 🖥️ **Onde rodar:** tudo desta fase acontece **na `vm-fend`** (RDP direto pelo `IP_FRONT`), porque é ela que tem o IIS público e onde o certificado será usado.

**Cenário:** emitir um certificado **wildcard** `*.<seu-dominio>` **+ o domínio raiz** `<seu-dominio>`, gratuito (Let's Encrypt), válido publicamente, com a zona DNS hospedada no **Azure DNS** e validação via plugin **Manual** (você cria os registros TXT). Nos exemplos abaixo usamos `tfteccloudlabs.cloud` — **troque pelo seu domínio** em todos os comandos.

> 💡 O wildcard `*.dominio.com` **não cobre** o próprio `dominio.com`. Por isso o certificado é emitido com **os dois nomes juntos** — e é por isso que serão **dois desafios TXT**.

#### 6.1 Ter um domínio com zona DNS pública

Você precisa de um **domínio próprio** (ex.: `tfteccloudlabs.cloud`) cuja zona DNS você controle.

> 📝 **Nota — não tem um domínio?** Recomendamos registrar um domínio barato na **[Hostinger](https://www.hostinger.com.br/)** (alguns custam poucos reais/ano). Qualquer registrador serve (Registro.br, Cloudflare, GoDaddy…) — o que importa é você conseguir **editar os Name Servers (NS)** do domínio, porque vamos delegá-lo ao Azure DNS no próximo passo. _Esta etapa é a única do guia com um custo possível (o registro do domínio); sem domínio, pule a Fase 5.5 e mantenha o app em HTTP._

#### 6.2 Criar a zona no Azure DNS e delegar o domínio

1. No Portal → busca → **DNS zones** → **+ Create**
2. **Resource group:** `rg-prd-tik-cin-001` · **Name:** `<seu-dominio>` (ex.: `tfteccloudlabs.cloud`) → **Review + create** → **Create**
3. Abra a zona criada → **Overview** → 📋 copie os **4 Name Servers** (algo como `ns1-XX.azure-dns.com`, `ns2-XX.azure-dns.net`…)
4. No **painel do seu registrador** (Hostinger/Registro.br/etc.) → seção de **Name Servers / DNS** do domínio → substitua os NS pelos **4 do Azure DNS** → salve.

> ⏳ **Propagação dos NS:** trocar Name Servers pode levar de minutos a algumas horas. Confirme com `Resolve-DnsName <seu-dominio> -Type NS -Server 8.8.8.8` — quando aparecerem os `azure-dns`, a delegação está ativa.

5. _(Recomendado)_ Crie um registro **A** apontando o domínio para o app: na zona → **+ Record set** → **Name:** `@` (ou `www`) · **Type:** A · **IP:** `IP_FRONT` (IP público da `vm-fend`).

#### 6.3 Instalar o Posh-ACME

PowerShell **como Administrador** na `vm-fend`:

```powershell
Install-Module -Name Posh-ACME -Scope CurrentUser
```

Durante a instalação:
- *NuGet provider is required to continue* → responda **Y**
- *Untrusted repository (PSGallery)* → responda **A** (Yes to All)

Se aparecer erro de política de execução:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

#### 6.4 Selecionar o servidor ACME

- **Para testar** (certificado não confiável, mas não consome rate limit):
  ```powershell
  Set-PAServer LE_STAGE
  ```
- **Para produção** (certificado válido na Internet):
  ```powershell
  Set-PAServer LE_PROD
  ```

> ⚠️ **Rate limit do Let's Encrypt em produção:** 50 certificados por domínio registrado por semana e 5 falhas de validação por hora. **Na primeira vez, vale testar no `LE_STAGE` antes** de ir para `LE_PROD`.

#### 6.5 Iniciar a emissão

```powershell
New-PACertificate '*.tfteccloudlabs.cloud','tfteccloudlabs.cloud' `
  -Plugin Manual -PluginArgs @{} `
  -AcceptTOS -Contact 'seuemail@tftec.com.br' `
  -PfxPass 'SuaSenhaForte123'
```

| Parâmetro | Função |
|---|---|
| `'*.dominio','dominio'` | Wildcard + raiz no mesmo certificado |
| `-Plugin Manual` | Você cria os TXT manualmente |
| `-AcceptTOS` | Aceita os termos do Let's Encrypt |
| `-Contact` | E-mail para avisos de expiração |
| `-PfxPass` | Define a senha do PFX já na emissão (se omitir, a senha padrão é `poshacme`) |

O comando **pausa** e exibe algo assim:

```
Please create the following TXT records:
------------------------------------------
_acme-challenge.tfteccloudlabs.cloud -> pwqiMdRTFZh4rd_0Zpcn-Tq...
_acme-challenge.tfteccloudlabs.cloud -> A_8bpQswI1EIap4P_0Skze...
------------------------------------------
Press any key to continue.:
```

> 🛑 **NÃO pressione nenhuma tecla ainda e NÃO feche esta janela.** Os tokens são únicos desta emissão — se fechar, recomeça do zero com tokens novos. Deixe a janela aberta e siga o próximo passo **em outra janela**.

#### 6.6 Criar o registro TXT no Azure DNS (os DOIS valores no MESMO record set)

> ⚠️ **Pegadinha do Azure DNS:** não existem dois record sets com o mesmo nome e tipo. Se tentar criar um segundo TXT `_acme-challenge`, o Portal acusa: *"There is already a record set with the same name in this DNS zone…"*. A solução: **um único record set TXT com os dois valores dentro**.

No Portal → zona `tfteccloudlabs.cloud` → **+ Record set**:
- **Name:** `_acme-challenge`
- **Type:** **TXT**
- **TTL:** `300` (5 minutos — facilita correções)
- **Value:** cole o **primeiro** token → e na **linha em branco logo abaixo**, cole o **segundo** token
- **OK**

#### 6.7 Validar a replicação ANTES de continuar (etapa crítica)

Em **outra janela** do PowerShell, consulte um DNS público externo (não o cache local):

```powershell
Resolve-DnsName -Name '_acme-challenge.tfteccloudlabs.cloud' -Type TXT -Server 8.8.8.8
```

**Critério para prosseguir:** a resposta deve mostrar **DUAS** linhas TXT, uma com cada token:

```
Name                                  Type  TTL  Section  Strings
----                                  ----  ---  -------  -------
_acme-challenge.tfteccloudlabs.cloud  TXT   300  Answer   {A_8bpQswI1EIap4P_0Skze...}
_acme-challenge.tfteccloudlabs.cloud  TXT   300  Answer   {pwqiMdRTFZh4rd_0Zpcn-Tq...}
```

- **Apareceu só um token** → revise o record set (passo 6.6) e consulte de novo
- **Não apareceu nada** → aguarde 1–2 min e repita (no Azure DNS a propagação costuma levar menos de 1 min)
- **Quer uma segunda opinião?** Teste também com `-Server 1.1.1.1`

> 🛑 **Só avance quando os DOIS tokens estiverem respondendo.** Se pressionar a tecla antes da propagação, a validação falha e será preciso rodar o `New-PACertificate` de novo (com tokens novos).

#### 6.8 Continuar a validação

Com os dois tokens confirmados na consulta externa, volte à janela do Posh-ACME e **pressione qualquer tecla**. O Posh-ACME envia os desafios ao Let's Encrypt, que consulta o DNS, valida e **emite o certificado** em alguns segundos.

#### 6.9 Localizar os arquivos e escolher o PFX correto

```powershell
Get-PACertificate | Format-List
```

Os arquivos ficam em `%LOCALAPPDATA%\Posh-ACME\LE_PROD\<conta>\<dominio>\`:

| Arquivo | Conteúdo | Quando usar |
|---|---|---|
| **`fullchain.pfx`** ✅ | Certificado + chave privada + cadeia intermediária | **Use este** no **IIS** (também serve para Key Vault, App Gateway etc.) |
| `cert.pfx` | Certificado + chave privada (sem cadeia) | Evitar — clientes podem falhar ao montar a cadeia |
| `cert.cer` + `cert.key` | Certificado e chave separados (PEM) | Nginx, Apache, appliances |
| `fullchain.cer` | Certificado + intermediário (PEM) | Nginx (`ssl_certificate`) |
| `chain.cer` | Só a cadeia intermediária | Configs que pedem a chain separada |

#### 6.10 Senha do PFX

- **Se você usou `-PfxPass` no passo 6.5:** a senha já é a que você definiu. Nada a fazer.
- **Se NÃO usou (senha atual = `poshacme`):** troque com uma linha (regenera os PFX sem reemitir o certificado):
  ```powershell
  Set-PAOrder -MainDomain '*.tfteccloudlabs.cloud' -PfxPass 'SuaSenhaForte123'
  Get-PACertificate | Select-Object PfxPass, PfxFullChain
  ```
  > 💡 A senha fica salva na configuração da order — renovações futuras já geram o PFX com ela automaticamente.

#### 6.11 Instalar o certificado no IIS e criar o binding HTTPS (443)

Agora que você tem o `fullchain.pfx`, aplique-o no site do frontend:

1. **IIS Manager** → clique no **nome do servidor** (raiz) → duplo clique em **Server Certificates** → painel direito → **Import...**
2. **Certificate file:** aponte para o `fullchain.pfx` (caminho do passo 6.9) · **Password:** a senha do PFX · **Certificate store:** *Personal* → **OK**
3. Painel esquerdo → **Sites → `FIFA2026-Web`** → painel direito → **Bindings... → Add**:
   - **Type:** `https` · **IP address:** All Unassigned · **Port:** `443` · **Host name:** `<seu-dominio>` (ou em branco)
   - **SSL certificate:** selecione o `*.<seu-dominio>` que você importou → **OK**
4. _(Recomendado)_ Garanta a porta 443 no firewall do Windows da `vm-fend`:
   ```powershell
   New-NetFirewallRule -DisplayName "HTTPS" -Direction Inbound -Protocol TCP -LocalPort 443 -Action Allow
   ```
   (A NSG da `vm-fend` já libera 443 da Internet — Fase 2, passo 4.)

> ⚠️ **Validade: 90 dias.** Com o plugin Manual, a renovação exige **repetir os passos dos TXT** (os tokens mudam a cada emissão). Para um evento, 90 dias sobram; em produção real você automatizaria com um plugin de DNS (ex.: `Azure`) em vez do `Manual`.

> ✅ **Pronto quando:** acessando `https://<seu-dominio>` no navegador (do seu computador), o site abre com **cadeado válido** (sem aviso de certificado) e o app FIFA 2026 carrega.

---

### Fase 7 — Smoke test

Saia do RDP — agora teste do **seu computador**, com a Internet real.

#### 7.1 No navegador

Abra: **`http://<IP_FRONT>`** (o IP público da `vm-fend`)

- [ ] A **home** carrega (lista de jogos/estádios visível)
- [ ] Clique em "**Entrar**" → faça login com `admin@fifa2026.com` / `admin123` (senha padrão do seed do bacpac)
- [ ] Listagem de **jogos** mostra 104 partidas
- [ ] **Cadastre um usuário novo** → faça **login**
- [ ] **Compre um ingresso** → recebe o ingresso premium com **QR code**
- [ ] Acesse a **página de validação** do ingresso (link no QR) → mostra "válido"
- [ ] Login admin → **painel de vendas/usuários** abre

#### 7.2 PowerShell — validação automatizada (no seu computador)

```powershell
$FRONT_IP = "<IP_FRONT>"

# Frontend responde
Invoke-WebRequest "http://$FRONT_IP" -UseBasicParsing | Select-Object StatusCode

# Proxy /api funciona
Invoke-RestMethod "http://$FRONT_IP/api/health"

# Login
$body = @{ email='admin@fifa2026.com'; password='admin123' } | ConvertTo-Json
$r = Invoke-RestMethod "http://$FRONT_IP/api/auth/login" `
  -Method POST -ContentType 'application/json' -Body $body
$r.user.email   # admin@fifa2026.com

# 104 jogos
$h = @{ Authorization = "Bearer $($r.token)" }
(Invoke-RestMethod "http://$FRONT_IP/api/matches" -Headers $h).matches.Count   # 104
```

#### 7.3 Confirme que a API não responde direto pela Internet

Mesmo com a `vm-bend` ainda tendo IP público nesta fase, a **NSG só libera a porta `80` do backend para origens de dentro da VNet** (`10.20.0.0/16`, via o `Destination` da regra) — a Internet não passa. Confirme tentando o IP **público** do backend na porta 80:

```powershell
$BEND_PUB = "<IP_BEND_PUB>"
try {
  Invoke-WebRequest "http://${BEND_PUB}/api/health" -TimeoutSec 5 -UseBasicParsing
  Write-Error "FALHOU: backend está acessível pela Internet na porta 80!"
} catch {
  Write-Host "OK: porta 80 do backend bloqueada pela NSG (timeout esperado)" -ForegroundColor Green
}
```

> 🔒 **Isolamento total vem na Fase 8.** Aqui o que protege é a **NSG** (a porta 80 do backend só responde de dentro da VNet, graças ao `Destination` `10.20.2.0/24`). Na Fase 8 você remove de vez o IP público de `vm-bend` e `vm-data` — aí nem o RDP fica exposto.

> 🏁 **Conseguiu?** Você publicou uma aplicação 3 camadas em VMs Windows com IIS, iisnode, SQL Server, proxy reverso e regras de rede — **a forma "raiz" de fazer**. Falta só o endurecimento final (Fase 8). **Muito bem!** 🎉

---

### Fase 8 — Hardening final: remover IPs públicos + jump host

> 🔒 **Agora que tudo funciona, a gente tranca.** Esta é a fase que transforma o "laboratório aberto" numa topologia de **defesa em profundidade**: o frontend continua público (é o ponto de entrada do app), mas o **backend e o banco perdem o IP público** e passam a ser administrados **através** da `vm-fend` (jump host). Faça esta fase **só depois** do smoke test (Fase 7) passar.

#### 8.1 Remover o IP público da `vm-bend` e da `vm-data`

Para **cada** uma (`vm-prd-tk-bend-cin-001` e `vm-prd-tk-data-aes-001`):
1. Portal → abra a VM → **Networking** → aba **IP configurations** → clique em **ipconfig1**
2. **Public IP address:** **Dissociate** → **Save**
3. _(Opcional)_ Apague o recurso de **Public IP** órfão que sobrou (Busca → **Public IP addresses** → selecione → **Delete**) para não pagar reserva.

> 💡 A `vm-fend` **mantém** o IP público — é por ela que a Internet acessa o app e por onde você entra para o jump host.

#### 8.2 Ajustar as NSGs para acesso via jump host

**`nsg-prd-inf-cin-001`** (app) → **Inbound security rules**:
- **Edite** `allow-rdp-meu-ip`: mantenha (ela só alcança a `vm-fend`, que ainda tem IP público — é a porta de entrada do jump host).
- **+ Add** `allow-rdp-jump`: Source **IP Addresses → `10.20.1.0/24`** (subnet do front) · port `3389` · Allow · Priority 115 — permite o salto `vm-fend → vm-bend`.

**`nsg-prd-inf-aes-001`** (banco) → **Inbound security rules**:
- **Edite** `allow-rdp-meu-ip` → troque a Source para **`10.20.0.0/16`** (VNet do app, via peering) e renomeie para `allow-rdp-jump`. Assim o RDP no banco só vem pelo jump host, nunca da Internet.

#### 8.3 Acessar back/data pelo jump host

1. RDP na `vm-fend` pelo **`IP_FRONT`** (user `tftecadmin`).
2. **Dentro** da `vm-fend`, abra "Remote Desktop Connection" e conecte ao **`IP_BACK`** (privado, `10.20.2.x`, user `tftecadmin`) ou ao **`IP_DB`** (privado, `10.30.1.x`, user `adminsql`).

> 💡 **Por que funciona entre regiões?** A `vm-fend` (Central India) enxerga a `vm-data` (Australia East) pelo **peering global** — o salto `vm-fend → IP_DB` atravessa as regiões pela rede privada. É o padrão jump host que SRE usa há décadas.

#### 8.4 Confirmar que o app continua no ar

Do seu computador, repita o smoke test da Fase 7 (`http://<IP_FRONT>` + o script PowerShell). **Nada deve quebrar** — o tráfego do app sempre foi `vm-fend → IP privado da vm-bend → IP privado da vm-data`; tirar o IP público de back/data não afeta o caminho da aplicação, só fecha as portas de administração.

> ✅ **Pronto quando:** `vm-bend` e `vm-data` **não têm mais IP público**, o RDP nelas só funciona via jump host pela `vm-fend`, e o app continua respondendo em `http(s)://<seu-domínio>`.

---

### Fase 9 — Troubleshooting + desligar as VMs

#### 9.1 Tabela de troubleshooting

| Sintoma | Causa provável | O que fazer |
|---|---|---|
| Backend dá **HTTP 500.19** (`0x80070021`, _"section locked at a parent level"_) | Seções `handlers`/`modules` travadas no IIS (delegação negada) | Rode o `appcmd unlock` da **Fase 4.3** + `iisreset` (ou IIS Manager → nó do servidor → Feature Delegation → `Handler Mappings`/`Modules` → Read/Write) |
| Front abre, mas `/api/*` retorna 502 | ARR proxy não habilitado | IIS Manager → ARR → Server Proxy Settings → ✅ **Enable proxy** |
| Front abre, mas `/api/*` retorna 404 | URL Rewrite não instalado, ou `__BACKEND_URL__` não substituído | Reinstale URL Rewrite; confirme que o `web.config` **não** contém mais `__BACKEND_URL__` (Fase 5.4) |
| Backend retorna 500 Internal Server Error | `.env` errado, ou `node_modules` não veio no zip | Veja `C:\inetpub\wwwroot\fifa2026-api\logs\*.log` (stderr do iisnode); confirme que existe a pasta `node_modules\` — se faltar, rebaixe e reextraia o `fifa2026-api.zip` |
| `/api/health` OK mas `/api/matches` retorna `"Erro ao buscar jogos"` | A API conecta no banco e a query falha — **diagnostique com `curl.exe -s http://localhost/api/health/db`** (ele devolve o erro real + a config em uso) | Rode o `/api/health/db`: `connected` → resolveu; `code: ETIMEOUT/ESOCKET` → rede (veja linha abaixo); `ELOGIN` → senha/login; `Invalid object name` → bacpac não importado. **Editou o `.env`? Faça `iisreset`** — o iisnode NÃO recarrega o `.env` sozinho (não está em `watchedFiles`), então valor antigo fica em cache |
| Backend não conecta no SQL (`ETIMEOUT`/`ESOCKET`) | TCP/IP do SQL off, firewall Windows 1433, `DB_SERVER` errado, **ou VNets sem peering / NSG do banco com origem errada** | `Test-NetConnection <IP_DB> -Port 1433` na vm-bend. Se `False`: (1) **peering das 2 VNets = `Connected`**? (2) `nsg-prd-inf-aes-001` libera `1433` com origem **`10.20.0.0/16`** (VNet do app), não `10.30.x`? (3) TCP/IP do SQL habilitado + `New-NetFirewallRule` 1433 na vm-data? (4) `DB_SERVER` = IP privado real da vm-data (`10.30.1.x`)? |
| Backend vê o SQL mas dá "Login failed" (`ELOGIN`) | `DB_USER`/`DB_PASSWORD` no `.env` não batem com as credenciais do wizard, ou a autenticação SQL não foi habilitada na criação da `vm-data` | Confirme `DB_USER=adminsql` / `DB_PASSWORD=Partiunuvem@2026` no `.env`; teste o login no SSMS (`localhost`, SQL Auth, `adminsql`). Se a `vm-data` foi criada **sem** "SQL Authentication = Enable" no wizard, ative pelo **SQL Server Configuration Manager** (Mixed Mode) e reinicie o serviço |
| Browser não abre o IP público | `nsg-prd-inf-cin-001` sem inbound 80/443; ou Windows Firewall dentro da VM bloqueando | Portal: `nsg-prd-inf-cin-001` → garanta inbound 80/443 da Internet; RDP na vm-fend: `New-NetFirewallRule -DisplayName "HTTP" -Direction Inbound -Protocol TCP -LocalPort 80 -Action Allow` |
| RDP na `vm-bend` ou `vm-data` falha | **Antes da Fase 8:** NSG sem `3389` do seu `MEU_IP`, ou seu IP público mudou. **Depois da Fase 8:** elas não têm mais IP público — só via jump host | Antes da Fase 8: confirme a regra `allow-rdp-meu-ip` com o seu IP atual e use o IP **público** (`IP_BEND_PUB`/`IP_DATA_PUB`). Depois da Fase 8: conecte a `vm-fend` primeiro e salte para o IP **privado** |
| Import do bacpac falha | Versão do SSMS antiga; ou download do `.bacpac` corrompido | Baixe SSMS mais recente; rebaixe o `.bacpac` pelo link do Blob |

> 📚 **Documentação adicional:** [`Lovable/World Cup Tickets Hub/DEPLOY_AZURE.md`](../Lovable/World%20Cup%20Tickets%20Hub/DEPLOY_AZURE.md) tem **8 partes detalhadas** se algum passo travar — use como fallback.

#### 9.2 💰 DESLIGAR as VMs (custo zero quando não usadas)

**Esse é o passo mais importante da sessão.** Esqueceu ligado = ~$3/dia.

**Pelo Portal (recomendado):**
1. Busca → **Virtual machines**
2. Para cada VM (`vm-prd-tk-fend-cin-001`, `vm-prd-tk-bend-cin-001`, `vm-prd-tk-data-aes-001`):
   - Abra → **Stop** (não "Restart"!) → confirme
3. ✅ Status muda para **Stopped (deallocated)** — **compute para de cobrar**

**Pelo Azure Cloud Shell (mais rápido):**
```bash
az vm deallocate -g rg-prd-tik-cin-001 -n vm-prd-tk-fend-cin-001 --no-wait
az vm deallocate -g rg-prd-tik-cin-001 -n vm-prd-tk-bend-cin-001 --no-wait
az vm deallocate -g rg-prd-tik-cin-001 -n vm-prd-tk-data-aes-001 --no-wait
```

Quando quiser voltar: `az vm start -g rg-prd-tik-cin-001 -n vm-prd-tk-fend-cin-001` (idem para as outras). Os IPs privados são preservados; o **IP público da `vm-fend` pode mudar** se você não tiver pago por um Static IP — anote o novo antes de testar.

#### 9.3 🧹 Apagar tudo (final do evento)

Se acabou e você não quer mais nada:

```bash
az group delete --name rg-prd-tik-cin-001 --yes --no-wait
```

Apaga em bloco: 3 VMs + 3 discos + 3 NICs + 2 NSGs + **2 VNets (com o peering)** + 1 Public IP — em **ambas as regiões**, já que tudo está no mesmo RG. **Custo zero a partir deste comando.**

---

## 📊 6. Tabela de variáveis e segredos

**Anotações que você fez ao longo do guia** (mantenha no seu bloco de notas, fora do Git):

| Onde | Nome | Exemplo / origem |
|---|---|---|
| 🔐 | *VM Admin Password* | Você escolheu na Fase 2 (login `tftecadmin` na `vm-fend` e `vm-bend`) |
| 🔐 | *SQL/VM adminsql* | Definido no wizard da `vm-data` (Fase 2, passo 8): login `adminsql` / senha `Partiunuvem@2026` — serve para o RDP da `vm-data` **e** para a autenticação SQL |
| 🔐 | *DB_PASSWORD* | Senha da autenticação SQL (`adminsql` → `Partiunuvem@2026`) — vai no `.env` |
| 🔢 | *MEU_IP* | Seu IP público (ifconfig.me) — origem das regras de RDP nas NSGs (Fase 2, passos 4/5) |
| 🔢 | *IP_FRONT* | Public IP da `vm-fend` (Fase 2, passo 6) — acessa o app **e** é a entrada do jump host |
| 🔢 | *IP_FRONT_PRIVADO* | Private IP da `vm-fend` (`10.20.1.x`) |
| 🔢 | *IP_BEND_PUB* | Public IP da `vm-bend` (Fase 2, passo 7) — só p/ RDP até a Fase 8 |
| 🔢 | *IP_BACK* | Private IP da `vm-bend` (`10.20.2.x`) — vai no `web.config` |
| 🔢 | *IP_DATA_PUB* | Public IP da `vm-data` (Fase 2, passo 8) — só p/ RDP até a Fase 8 |
| 🔢 | *IP_DB* | Private IP da `vm-data` (`10.30.1.x`) — vai no `.env` |

**No arquivo `C:\inetpub\wwwroot\fifa2026-api\.env` (na `vm-bend`):**

`DB_SERVER` · `DB_PORT` · `DB_USER` · `DB_PASSWORD` · `DB_NAME` · `PORT` · `HOST` · `JWT_SECRET` · `JWT_EXPIRES_IN` · `FRONTEND_URL`

**No arquivo `C:\inetpub\wwwroot\fifa2026-web\web.config` (na `vm-fend`):**

A regra de proxy vem com o placeholder `__BACKEND_URL__`. Você o substitui (Fase 5.4) pelo IP privado da `vm-bend`, ficando `<action type="Rewrite" url="http://<IP_BACK>/api/{R:1}" />` (porta 80, implícita). É a **única** edição manual do frontend — todo o resto do site já vem compilado no `fifa2026-web.zip`.

> 🔒 **Regra de ouro:** segredo nunca vai para o código nem para o repositório. Aqui ficam **no arquivo `.env` da `vm-bend`** e **na sua memória** (senhas de admin). _Evolução opcional:_ trocar `.env` por **Azure Key Vault** com Managed Identity nas VMs.

---

## 🛡️ 7. Evolução de segurança (o "VAR" da arquitetura)

> 🧠 **Tópico de aprendizado — não é passo do workshop.** O ambiente que você montou **funciona e ensina os princípios**. Mas todo arquiteto pergunta: *"o que ainda falta para produção de verdade?"*

**O que esse cenário VM já faz bem (após a Fase 8):**

- 🧅 **Defesa em profundidade real:** apenas a `vm-fend` é pública. Após o hardening da **Fase 8**, back e data **não têm mais IP público** — Internet não fala com elas, ponto.
- 🧗 **Padrão jump host:** você administra back/data **através** da front, em vez de expor 3389 ao mundo.
- 🔁 **Proxy reverso "raiz":** ARR + URL Rewrite no IIS — você entende o mecanismo do reverse proxy na sua versão mais crua, sem abstração.

**O que um time de produção ainda endureceria (ainda dentro de VMs):**

1. **Azure Bastion** em vez de RDP via vm-fend — Bastion é serviço gerenciado para acesso a VMs privadas via browser, com auditoria, MFA e zero portas RDP expostas. (Custo: ~$87/mês — só vale se for ambiente de longa duração.)
2. **Segredos no Key Vault** com Managed Identity — `DB_PASSWORD` e `JWT_SECRET` deixam de estar em texto plano no `.env`.
3. **Patches do OS automatizados** — Azure Update Manager para Windows Server. Em VM, **isso é problema seu**.
4. **Backups** — Azure Backup para as VMs (snapshot diário) ou Always On Availability Groups se quiser HA do SQL.
5. **IP público estático + WAF na borda** — Application Gateway (WAF) à frente da `vm-fend` filtra ataques antes de chegar ao IIS, e um IP estático evita que o endereço mude a cada `deallocate`.

> 🧠 **Lembre do escopo:** tudo aqui é endurecimento **da arquitetura em VMs**. Rodar a mesma aplicação em serviços gerenciados (App Service Plan / Web Apps) é um caminho diferente e **assunto de outra etapa** — não faz parte deste guia.

---

> 🏁 _Documento vivo — atualizado conforme o evento se aproxima (URL do repo público, dataset do bacpac, contagens). **Bola rolando!**_ ⚽🏆
