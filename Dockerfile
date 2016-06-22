FROM node:6.2.2

# Add our files & set working dir
ADD . /backend
WORKDIR /backend

RUN npm install
RUN npm install -g nodemon

# Environment variables
ENV DEBUG=*,-nodemon:*,-express:*

EXPOSE 80

CMD ["nodemon", "npm", "start"]
