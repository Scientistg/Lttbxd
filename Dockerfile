FROM node:18

WORKDIR /app

COPY package*.json ./
RUN npm install express @types/express
RUN npm install

COPY . .
EXPOSE 5000
CMD ["npm", "start"]
