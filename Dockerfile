# Use Node.js version 22 as the base image
FROM node:22

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install the dependencies
RUN npm install

RUN npm install nodemon -g

# Copy the rest of the application code
COPY . .

# Expose port 3002 to the outside world
EXPOSE 3002

# Command to run the application
CMD ["nodemon", "server.js"]