FROM nginx:alpine
ENV DOLLAR=$ \
    DOMAIN=localhost \
    FRONTEND_UPSTREAM=frontend:80 \
    BACKEND_UPSTREAM=backend:3000
COPY nginx.conf /etc/nginx/templates/default.conf.template
