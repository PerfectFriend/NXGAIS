# Linux beta 0.1.2

Рабочая нода для двух хостов лежит в [linux-node](linux-node/README.md).

Это отдельный каталог. Существующее веб-приложение, контракты и документы репозитория не заменяются.

```bash
git clone https://github.com/PerfectFriend/NeXXus-Node.git
cd NeXXus-Node/linux-node
chmod +x install/install.sh install/uninstall.sh
./install/install.sh
export PATH="$HOME/.local/bin:$PATH"
nexxus start
```

Нужен Node.js 22+. Панель: http://127.0.0.1:4378/ . Mesh: TCP 4377.

Рукопожатие v3: X25519 4DH + подпись Ed25519. Контакты `nexxus:1:nxx1…:pub@host:port`.
