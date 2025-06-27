# Base image with g++
FROM gcc:latest

# Create working directory
WORKDIR /app

# Copy all files into container
COPY . .

# Compile and run code (done at runtime via exec command)
# So we don't compile here in Dockerfile
CMD [ "sh", "-c", "g++ main.cpp -o main && ./main" ]
