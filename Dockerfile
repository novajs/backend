FROM mhart/alpine-node:6.3.0

# Add our files & set working dir
ADD . /backend
WORKDIR /backend

# Apline specific.
RUN apk add --update --no-cache make gcc g++ python

RUN npm install
RUN npm install -g nodemon

# Environment variables
ENV DEBUG=*,-nodemon:*,-express:*

EXPOSE 80

CMD ["nodemon", "npm", "start"]
