FROM mhart/alpine-node:6.3.0

# Apline specific.
RUN apk add --update --no-cache make gcc g++ python
RUN apk add bash git

RUN npm install -g pm2
WORKDIR /backend

VOLUME /backend/workspace

# Add our files & set working dir
ADD . /backend

# npm install
RUN npm install
RUN chmod +x ./serviceinit.sh

# Environment variables
ENV DEBUG backend:*,assignment:*
ENV DEBUG_COLORS 1
ENV TERM xterm


EXPOSE 80

CMD ["./serviceinit.sh"]
