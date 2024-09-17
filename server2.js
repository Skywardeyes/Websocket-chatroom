// 聊天室 WebSocket 服务器
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

// 用于存储所有的客户端连接
let clients = {};

// 创建 WebSocket 服务器
const server = new WebSocket.Server({ port: 2024 }, () => {
  console.log('WebSocket 服务器启动，正在监听 2024 端口');
});

// 处理客户端连接
server.on('connection', (socket) => {
  socket.on('message', (message) => {
    try {
      const clientDataContent = JSON.parse(message);
      const protocol = clientDataContent.protocol;

      switch (protocol) {
        case 'signin':
          signin(clientDataContent, socket);
          break;
        case 'broadcast':
          broadcast(clientDataContent);
          break;
        case 'p2p':
          p2p(clientDataContent);
          break;
        case 'file':
          handleFile(clientDataContent);
          break;
        default:
          socket.send(JSON.stringify({ error: '未识别的通信协议' }));
          break;
      }
    } catch (error) {
      socket.send(JSON.stringify({ error: '服务器处理消息时出错' }));
    }
  });

  socket.on('close', () => {
    handleDisconnect(socket);
  });
});

// 客户端登录处理
function signin(clientDataContent, socket) {
  const username = clientDataContent.from;

  // 广播用户上线消息
  if (Object.keys(clients).length) {
    const onlineNotice = {
      protocol: 'online',
      online: username,
      onlineCount: Object.keys(clients).length + 1,
    };
    broadcast(onlineNotice);
  }

  // 将客户端连接存储
  clients[username] = socket;
  console.log(`欢迎 ${username} 加入聊天室，当前在线：${Object.keys(clients).length}`);
}

// 广播消息
function broadcast(message) {
  const messageString = JSON.stringify(message);

  // 发送给所有客户端
  for (let username in clients) {
    clients[username].send(messageString);
  }
}

// 点对点消息
function p2p(clientDataContent) {
  const targetClient = clients[clientDataContent.to];
  if (targetClient) {
    targetClient.send(JSON.stringify(clientDataContent));
  }
}

// 处理文件消息
function handleFile(clientDataContent) {
  const username = clientDataContent.from;
  const filename = clientDataContent.filename;
  const content = clientDataContent.content;

  // 将文件内容写入服务器
  const filePath = path.join(__dirname, 'uploads', filename);
  fs.writeFile(filePath, content, (err) => {
    if (err) {
      console.error(`保存文件 ${filename} 失败：`, err);
      return;
    }

    console.log(`文件 ${filename} 保存成功`);

    // 广播文件发送消息
    const fileNotice = {
      protocol: 'file',
      from: username,
      filename: filename,
    };
    broadcast(fileNotice);
  });
}

// 处理客户端断开连接
function handleDisconnect(socket) {
  let disconnectedUser = null;

  // 找到断开的用户
  for (let username in clients) {
    if (clients[username] === socket) {
      disconnectedUser = username;
      delete clients[username];
      break;
    }
  }

  if (disconnectedUser) {
    const offlineNotice = {
      protocol: 'offline',
      offline: disconnectedUser,
      onlineCount: Object.keys(clients).length,
    };
    broadcast(offlineNotice);
    console.log(`${disconnectedUser} 下线了，当前在线：${Object.keys(clients).length}`);
  }
}
