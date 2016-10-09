FROM mhart/alpine-node:latest

# DevOps.
EXPOSE 80
CMD ["./service/init.sh"]
WORKDIR /backend
VOLUME /backend/workspace

# Apline specific.
RUN apk add --update --no-cache make gcc g++ python bash git

# Install our process manager.
RUN npm install -g pm2

# Cache npm packages when package.json hasn't been modified.
COPY package.json /backend
RUN npm install

COPY . /backend
