FROM nginx:alpine-slim
COPY ./build /usr/share/nginx/html
COPY ./ci/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
CMD ["nginx-debug", "-g", "daemon off;"]
