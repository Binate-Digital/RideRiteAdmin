FROM node:22

WORKDIR /app

EXPOSE 5173

#CMD tail -f /dev/null

CMD ["npm", "run", "dev", "--", "--host"]
