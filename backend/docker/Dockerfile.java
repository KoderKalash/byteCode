# `openjdk` is deprecated on Docker Hub; eclipse-temurin is the maintained image.
FROM eclipse-temurin:21-jdk

# No COPY of the project. The submission is bind-mounted into /sandbox at run
# time by the executor, so this image holds only the toolchain.
WORKDIR /sandbox

# The command is supplied per-invocation by executor/language/java.js.
