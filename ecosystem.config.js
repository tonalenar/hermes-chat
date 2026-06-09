module.exports = {
  apps: [{
    name: 'hermes-chat',
    script: 'node_modules/.bin/next',
    args: 'start -p 3000',
    cwd: '/home/ubuntu/hermes-chat',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    exec_mode: 'fork',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    error_file: '/home/ubuntu/hermes-chat/logs/error.log',
    out_file: '/home/ubuntu/hermes-chat/logs/output.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }]
};
