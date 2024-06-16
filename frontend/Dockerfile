
FROM nginx:alpine

# Copy the custom Nginx configuration file into the container
COPY nginx.conf /etc/nginx/conf.d/default.conf


COPY src/ /usr/share/nginx/html/


EXPOSE 80


CMD ["nginx", "-g", "daemon off;"]
