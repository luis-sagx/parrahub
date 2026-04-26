import http from 'k6/http';
import { check } from 'k6';

export const options = {
  vus: 1,
  iterations: 1,
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001/api';

export default function () {
  const login = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({
      username: __ENV.ADMIN_USERNAME || 'admin',
      password: __ENV.ADMIN_PASSWORD || 'Admin1234!',
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );

  check(login, {
    'login responde 200': (res) => res.status === 200,
    'login devuelve token': (res) => Boolean(res.json('access_token')),
  });
}
