FROM node:14

WORKDIR /app

COPY package*.json ./

RUN npm install amazon-cognito-identity-js aws-sdk

COPY . .

EXPOSE 3000

CMD ["node", "index.js"]
