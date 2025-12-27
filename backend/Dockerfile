# Use Node.js LTS image
FROM node:18-slim

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install --production

# Copy the rest of the backend code
COPY . .

# Expose the port (Railway uses PORT environment variable)
EXPOSE 5000

# Start the Node.js server
CMD ["npm", "start"]
