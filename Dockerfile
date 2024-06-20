FROM node:22.2-bookworm-slim

RUN npx -y playwright@1.44.1 install chromium --with-deps

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ENV MONEYFORWARD_EMAIL \
    MONEYFORWARD_PASSWORD \
    MONEYTREE_EMAIL \
    MONEYTREE_PASSWORD \
    PORT=8080

EXPOSE $PORT

VOLUME ["/app/cookies"]

CMD ["npm", "run"]
