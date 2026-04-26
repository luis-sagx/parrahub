import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';

export const ws_connection_time = new Trend('ws_connection_time');
export const message_delivery_time = new Trend('message_delivery_time');

export const options = {
  stages: [
    { duration: '30s', target: 50 },
    { duration: '2m', target: 50 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'],
    http_req_failed: ['rate<0.01'],
    ws_connection_time: ['p(95)<1000'],
    message_delivery_time: ['p(95)<1000'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001/api';

export function setup() {
  const login = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({
      username: __ENV.ADMIN_USERNAME || 'admin',
      password: __ENV.ADMIN_PASSWORD || 'Admin1234!',
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );

  check(login, { 'admin login ok': (res) => res.status === 200 });
  return { token: login.json('access_token') };
}

export default function (data) {
  const rooms = http.get(`${BASE_URL}/rooms`, {
    headers: { Authorization: `Bearer ${data.token}` },
  });

  check(rooms, { 'rooms responde 200': (res) => res.status === 200 });
  sleep(Math.random() * 3 + 2);
}
