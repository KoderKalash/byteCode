# Base image with JDK
FROM openjdk:latest

# Set working directory
WORKDIR /app

# Copy files into container
COPY . .

# Compile and run (at runtime)
CMD [ "sh", "-c", "javac Main.java && java Main" ]
