<p align="center">
  <img src="assets/images/banner-top.jpg" alt="NeXXUs Sovereign Crypto-Cloud Hosting" width="100%" style="border-radius: 12px; box-shadow: 0 20px 50px rgba(0,0,0,0.6);" />
</p>

# 🌌 NeXXUs — Nube Criptográfica Descentralizada y Red Soberana de Almacenamiento P2P

> **Plataforma Peer-to-Peer soberana para el almacenamiento ultra-seguro de datos confidenciales, secretos, claves y archivos privados, totalmente independiente de corporaciones en la nube, centros de datos centralizados y censura.**

<p align="center">
  <b>🌐 Idioma / Language / Язык:</b><br>
  <a href="README.md"><b>English (EN)</b></a> •
  <a href="README.ru.md"><b>Русский (RU)</b></a> •
  <b>Español (ES)</b>
</p>

---

[![Wire Protocol](https://img.shields.io/badge/Wire_Protocol-v2.0.0_Big--Endian-06b6d4?style=for-the-badge&logo=wireguard)](PROTOCOL_WIRE_SPEC.md)
[![Zero-Knowledge](https://img.shields.io/badge/Security-Zero--Knowledge_ChaCha20--Poly1305-10b981?style=for-the-badge&logo=shield)](PROTOCOL_WIRE_SPEC.md)
[![Erasure Coding](https://img.shields.io/badge/Fault_Tolerance-Reed--Solomon_(4+2)_GF(2^8)-f59e0b?style=for-the-badge&logo=speedtest)](test/protocol.test.ts)
[![Golden Vectors](https://img.shields.io/badge/Golden_Vectors-113%2F113_PASS-8b5cf6?style=for-the-badge&logo=checkmarx)](nexxus-vectors/)
[![Tor Onion](https://img.shields.io/badge/Transport-Tor_v3_Onion_P2P-ec4899?style=for-the-badge&logo=torproject)](PROTOCOL_WIRE_SPEC.md)
[![Ubuntu Installer](https://img.shields.io/badge/Linux_Deploy-Ubuntu_One--Liner-E95420?style=for-the-badge&logo=ubuntu)](install.sh)
[![Windows Installer](https://img.shields.io/badge/Windows_Deploy-PowerShell_One--Liner-0078D6?style=for-the-badge&logo=windows)](install.ps1)
[![Android Installer](https://img.shields.io/badge/Android_Deploy-Termux_One--Liner-3DDC84?style=for-the-badge&logo=android)](scripts/install-android-termux.sh)

---

## 📑 Tabla de Contenidos

1. [Manifiesto y Principios Clave](#-manifiesto-del-proyecto)
2. [Arquitectura y Matemática de Resiliencia](#-arquitectura-y-matemática-de-resiliencia)
3. [⚡ Instalación Rápida en Linux (Ubuntu/Debian) en 1 Comando](#-instalación-rápida-en-linux-ubuntudebian-en-1-comando)
4. [🪟 Instalación Rápida en Windows en 1 Comando](#-instalación-rápida-en-windows-en-1-comando)
5. [📱 Instalación en Android (Termux)](#-instalación-en-android-termux)
6. [📦 Paquetes Listos para Descargar (.deb, .tar.gz, .zip)](#-paquetes-listos-para-descargar)
7. [🛠️ Referencia Completa de Comandos CLI (`nexxusd`)](#️-referencia-completa-de-comandos-cli-nexxusd)
8. [⚙️ Configuración y Variables de Entorno](#️-configuración-y-variables-de-entorno)
9. [🌐 Guía: Conexión de Múltiples Servidores en Red Mesh](#-guía-conexión-de-múltiples-servidores-en-red-mesh)
10. [📈 Economía y Modelo de Mercado (2026–2029)](#-economía-y-modelo-de-mercado-20262029)
11. [❓ Preguntas Frecuentes (FAQ)](#-preguntas-frecuentes-faq)

---

## ⚡ Manifiesto del Proyecto

Los servicios de nube centralizados tradicionales (AWS S3, Google Cloud, Microsoft Azure, Dropbox) conllevan riesgos estructurales insalvables:
* **Punto único de falla (SPOF)**: fallas de centros de datos, bloqueos arbitrarios de cuentas o sanciones pueden revocar el acceso a tus datos de forma instantánea.
* **Ilusión de privacidad**: los metadatos, direcciones IP, tamaños de archivos y frecuencias de consulta son rastreados y monetizados continuamente.
* **Vulnerabilidad jurisdiccional**: exposición a órdenes de registro gubernamentales y puertas traseras corporativas.

**NeXXUs reemplaza los servidores corporativos con matemáticas criptográficas puras y un enjambre P2P descentralizado.** Tus archivos nunca se almacenan completos en ningún servidor del mundo. Se segmentan en microfragmentos de exactamente 16 KB, se encriptan localmente con **ChaCha20-Poly1305 (Zero-Knowledge)**, se codifican mediante matrices de tolerancia a fallos **Reed-Solomon (4+2)** y se dispersan a través de una red anónima **Tor v3**.

---

## 🏛️ Arquitectura y Matemática de Resiliencia

```
   ┌────────────────────────────────────────────────────────────────────────┐
   │                        TU DISPOSITIVO (CLIENTE)                        │
   │  1. Acceso: Mnemónico Maestro BIP-39 (12/24 palabras)                  │
   │  2. Fragmentación: Micro-bloques exactos de 16 KB (16,384 bytes)       │
   │  3. Cifrado local: ChaCha20-Poly1305 (AEAD, 256 bits, RFC 8439)        │
   │  4. Codificación de borrado: Reed-Solomon (4+2) en cuerpo Galois GF(2^8)│
   └───────────────────────────────────┬────────────────────────────────────┘
                                       │
            Fragmentos 1-6 (4 de datos + 2 de paridad de 4 KB c/u)
                                       │
                                       ▼
   ┌────────────────────────────────────────────────────────────────────────┐
   │                      ENJAMBRE DESCENTRALIZADO P2P                      │
   │  • Transporte anónimo: Tor v3 Onion (direcciones de 62 caracteres)     │
   │  • Kademlia DHT de 256 bits con enrutamiento por distancia XOR         │
   │  • Anti-Outsource: validación de latencia de disco NVMe (< 50 ms)      │
   │  • Protección antimonopolio: Índice ASN Herfindahl (HHI ≤ 2500)        │
   │  • Auto-sanación autónoma (Self-Healing) ante caída de 2 nodos         │
   └───────────────────────────────────┬────────────────────────────────────┘
                                       │
        ┌──────────────┬───────────────┼───────────────┬──────────────┐
        ▼              ▼               ▼               ▼              ▼
   [Nodo #1: 4KB] [Nodo #2: 4KB] [Nodo #3: 4KB] [Nodo #4: 4KB] [Nodo #5: 4KB]
    (Alemania)       (Brasil)       (Islandia)        (Japón)        (Canadá)
```

### 1. Cuantización y Codificación Reed-Solomon (4+2)
* **Tamaño del bloque**: exactamente `16,384 bytes` (16 KB).
* **Matriz de Vandermonde sobre $GF(2^8)$** con polinomio primitivo `0x11D` ($x^8 + x^4 + x^3 + x^2 + 1$).
* Cada bloque se divide en **4 fragmentos de datos** y **2 fragmentos de paridad** (de 4,096 bytes cada uno).
* **Garantía matemática**: se requieren cualesquiera 4 de los 6 fragmentos para reconstruir el archivo al 100%. Incluso ante la pérdida total de 2 servidores, la integridad se preserva bit por bit.

### 2. Cifrado en Origen Zero-Knowledge (ChaCha20-Poly1305)
* Todos los datos se cifran **en el dispositivo del usuario antes de salir a la red**.
* Cifrado simétrico **ChaCha20** con clave de 256 bits y código de autenticación de mensajes **Poly1305** (RFC 8439).
* Los nodos de almacenamiento solo reciben ruido ininteligible; los operadores no pueden saber el nombre, tipo ni contenido de los archivos.

### 3. Auditoría Proof-of-Retrievability (PoR)
* El enjambre audita continuamente a los nodos mediante retos criptográficos aleatorios: $s \in \{0, 1\}^{256}$.
* Plazo límite de respuesta: **estrictamente 3,000 ms** (tiempo real en NVMe: 1–4 ms).
* Cualquier intento de engañar o redirigir el tráfico a un almacenamiento externo lento (como AWS S3) causa un fallo de latencia y la expulsión inmediata del nodo con pérdida de fianza.

---

## ⚡ Instalación Rápida en Linux (Ubuntu/Debian) en 1 Comando

El script de instalación permite desplegar un nodo soberano en cualquier máquina con Ubuntu (20.04, 22.04, 24.04 LTS) o Debian **en una sola línea de consola**:

### 🚀 Método 1: Instalación remota mediante `curl | bash` (Recomendado)

```bash
curl -fsSL https://raw.githubusercontent.com/PerfectFriend/NeXXus-Node/main/install.sh | bash
```

> 💡 **Acciones automáticas del instalador:**
> 1. Comprueba privilegios `sudo` y recursos de hardware (CPU, RAM, disco).
> 2. Instala automáticamente Node.js LTS oficial (v20) de NodeSource si no está presente.
> 3. Clona o actualiza el repositorio en `/opt/nexxus`.
> 4. Compila el paquete autónomo optimizado `dist/nexxusd.cjs`.
> 5. Configura el ejecutable global `/usr/local/bin/nexxusd`.
> 6. Crea la estructura de directorios en `/var/lib/nexxus` (`chunks/`, `meta/`, `logs/`).
> 7. Aplica optimizaciones del kernel en `/etc/sysctl.d/99-nexxus.conf` para máximo rendimiento en discos NVMe.
> 8. Genera la identidad criptográfica del nodo (`node_identity.json`) con claves Ed25519 y dirección **Tor Onion v3**.
> 9. Registra e inicia el servicio del sistema **systemd** (`nexxus-node.service`) con inicio automático.

#### Instalación con parámetros personalizados:
```bash
curl -fsSL https://raw.githubusercontent.com/PerfectFriend/NeXXus-Node/main/install.sh | bash -s -- --storage-gb=500 --port=3999 --peers=192.168.1.10:3999
```

### 📦 Método 2: Instalación vía paquete Debian (.deb)
```bash
wget https://raw.githubusercontent.com/PerfectFriend/NeXXus-Node/main/public/packages/nexxus-node_latest_amd64.deb
sudo dpkg -i nexxus-node_latest_amd64.deb || sudo apt-get install -f -y
nexxusd init
sudo systemctl enable --now nexxus-node
```

### 🔨 Método 3: Instalación desde clon local de Git
```bash
git clone https://github.com/PerfectFriend/NeXXus-Node.git
cd NeXXus-Node
sudo bash install.sh
```

---

## 🪟 Instalación Rápida en Windows en 1 Comando

Para sistemas Windows 10/11 se incluye un instalador automatizado por PowerShell y lanzadores Batch listos para usar.

### 🚀 Método 1: One-Liner en PowerShell (Recomendado)

Abra **PowerShell como Administrador** y ejecute:

```powershell
irm https://raw.githubusercontent.com/PerfectFriend/NeXXus-Node/main/install.ps1 | iex
```

### 🖱️ Método 2: Doble clic en `install.bat` (Para repositorio local o ZIP)
Si descargó el archivo ZIP o clonó el repositorio:
1. Haga clic derecho sobre `install.bat` y seleccione **«Ejecutar como administrador»**.
2. El script saltará automáticamente la política de ejecución de PowerShell, configurará Node.js LTS en modo desatendido (si falta), copiará los binarios y registrará el nodo.

### 🎮 Control del Nodo en Windows:
* `nexxus-start.bat`: Inicia el demonio P2P en consola o segundo plano.
* `nexxus-stop.bat`: Detiene todos los procesos activos de NeXXUs.
* `nexxusd status`: Consulta el estado del nodo, memoria asignada e identidad Tor.
* `nexxusd test-por`: Ejecuta una prueba de rendimiento del algoritmo Proof-of-Retrievability.

---

## 📱 Instalación en Android (Termux)

Transforma cualquier smartphone Android con almacenamiento rápido UFS en un nodo P2P permanente de la red.

Abre la aplicación **Termux** y pega:

```bash
curl -fsSL https://raw.githubusercontent.com/PerfectFriend/NeXXus-Node/main/scripts/install-android-termux.sh | bash
```

* **Wakelock**: activa automáticamente `termux-wake-lock` para evitar la suspensión del CPU con la pantalla apagada.
* **Arranque automático**: compatible con `Termux:Boot` para levantarse tras reiniciar el teléfono.

---

## 📦 Paquetes Listos para Descargar

Todos los paquetes precompilados se encuentran disponibles en la carpeta `public/packages/`:

| Plataforma | Formato | Enlace de descarga | Propósito |
|---|---|---|---|
| **Ubuntu / Debian** | `.deb` | [`nexxus-node_latest_amd64.deb`](public/packages/nexxus-node_latest_amd64.deb) | Instalación con gestor nativo `dpkg -i` |
| **Linux Universal** | `.tar.gz` | [`nexxus-node_latest_linux_x86_64.tar.gz`](public/packages/nexxus-node_latest_linux_x86_64.tar.gz) | Archivo universal para Arch, Fedora, Alpine, etc. |
| **Windows 10/11** | `.zip` | [`nexxus-node_latest_windows_x64.zip`](public/packages/nexxus-node_latest_windows_x64.zip) | Paquete autónomo con `install.bat` y lanzadores `.bat` |

---

## 🛠️ Referencia Completa de Comandos CLI (`nexxusd`)

| Comando | Descripción | Ejemplo |
|---|---|---|
| `nexxusd serve` | Inicia el demonio de almacenamiento P2P en modo interactivo o servicio | `nexxusd serve --port=3999` |
| `nexxusd init` | Genera una nueva identidad criptográfica soberana y dirección Tor Onion | `nexxusd init` o con mnemónico: `nexxusd init --mnemonic="..."` |
| `nexxusd id` | Muestra la identidad del nodo, clave pública Ed25519 y dirección Onion v3 | `nexxusd id` |
| `nexxusd status` | Muestra el estado del nodo, espacio NVMe usado y reputación | `nexxusd status` |
| `nexxusd peers` | Lista todos los nodos mesh conectados y latencias RTT en tiempo real | `nexxusd peers` |
| `nexxusd peer add <IP:PORT>` | Conecta a un nodo remoto e intercambia credenciales criptográficas | `nexxusd peer add 192.168.1.50:3999` |
| `nexxusd test-por` | Ejecuta la prueba de latencia de disco Proof-of-Retrievability (<3000 ms) | `nexxusd test-por` |
| `nexxusd test-interhost <IP:PORT>` | Auditoría completa en 6 fases de conectividad P2P contra un nodo remoto | `nexxusd test-interhost 192.168.1.50:3999` |
| `nexxusd upload <archivo>` | Fragmenta un archivo local en bloques de 16KB, aplica RS(4+2) y lo dispersa | `nexxusd upload /ruta/a/archivo.pdf` |
| `nexxusd download <hash> <destino>` | Recupera fragmentos de la red, reconstruye por Reed-Solomon y descifra | `nexxusd download <sha256> /tmp/descifrado.bin` |
| `nexxusd logs [-n N]` | Consulta las últimas entradas del registro de eventos estructurado | `nexxusd logs -n 50` |
| `nexxusd benchmark` | Prueba de velocidad de lectura/escritura NVMe y cálculo de Merkle Trees | `nexxusd benchmark` |

---

## ⚙️ Configuración y Variables de Entorno

Archivo de configuración principal en Linux: `/etc/nexxus/nexxus.conf` (o `nexxus.conf` en el directorio de Windows):

```ini
# Interfaz de red y puerto de escucha
NEXXUS_HOST=0.0.0.0
NEXXUS_PORT=3999

# Directorio de datos y cuota de almacenamiento en NVMe (en GB)
NEXXUS_DATA_DIR=/var/lib/nexxus
NEXXUS_STORAGE_GB=384

# Parámetros de tolerancia a fallos Reed-Solomon
NEXXUS_REED_SOLOMON_DATA=4
NEXXUS_REED_SOLOMON_PARITY=2
NEXXUS_CHUNK_SIZE_KB=16

# Nodos iniciales de conexión al enjambre (separados por comas)
NEXXUS_BOOTSTRAP_PEERS=192.168.1.10:3999,192.168.1.20:3999

# Nivel de detalle de registros (debug, info, warn, error)
NEXXUS_LOG_LEVEL=info
```

---

## 🌐 Guía: Conexión de Múltiples Servidores en Red Mesh

1. Instale NeXXUs en el **Servidor 1** (`192.168.1.10`) y en el **Servidor 2** (`192.168.1.20`).
2. En el **Servidor 1**, añada el **Servidor 2**:
   ```bash
   nexxusd peer add 192.168.1.20:3999
   ```
3. Ejecute la prueba de validación inter-host 6-en-1:
   ```bash
   nexxusd test-interhost 192.168.1.20:3999
   ```
4. Suba un archivo confidencial para almacenamiento distribuido:
   ```bash
   nexxusd upload /tmp/documento_privado.pdf
   ```

---

## 📈 Economía y Modelo de Mercado (2026–2029)

Análisis estratégico completo y tokenomía: 👉 [docs/MARKET_FORECAST_AND_TOKENOMICS_3Y.md](docs/MARKET_FORECAST_AND_TOKENOMICS_3Y.md)

* **Segunda vida para smartphones antiguos**: Más de 5,300 millones de móviles en desuso en el mundo. Conectados al Wi-Fi del hogar, consumen solo 1.5 W y funcionan como nodos permanentes con batería que actúa como SAI (UPS) natural.
* **Invariante matemático anti-ataques (Anti-Loop Invariant)**: $\text{Tarifa}_{\text{emisor}} (1.30) > \text{Recompensa}_{\text{nodo}} (1.25)$. Todo intento de auto-asignarse datos para farmear recompensas genera una pérdida neta estricta de $-0.05$ NEXX por ciclo.

---

## ❓ Preguntas Frecuentes (FAQ)

#### ¿Cómo abrir el puerto en el cortafuegos de Ubuntu?
```bash
sudo ufw allow 3999/tcp comment "NeXXUs P2P Wire Protocol"
sudo ufw reload
```

#### ¿Se requiere una dirección IP pública estática?
Para conexiones directas IP es conveniente, pero **no obligatorio**. NeXXUs integra transporte anónimo vía **Tor Onion v3**, lo que permite atravesar routers y NAT de forma automática sin redirección de puertos.

#### ¿Cómo respaldar y migrar un nodo a otro equipo?
Guarde de forma segura la frase mnemónica de 12 palabras obtenida al ejecutar `nexxusd init`. En el nuevo equipo, ejecute:
```bash
nexxusd init --mnemonic="sus doce palabras mnemónicas aquí..."
```

---

<p align="center">
  <b>Diseñado para la custodia libre, soberana e indestructible de la información.</b><br>
  <sub>NeXXUs Protocol Core • Versión 2.0.0</sub>
</p>
