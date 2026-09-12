# Pinned: "latest" silently changes the compiler version under your users.
FROM gcc:13

# No COPY of the project. The submission is bind-mounted into /sandbox at run
# time by the executor, so this image holds only the toolchain.
WORKDIR /sandbox

# The command is supplied per-invocation by executor/language/cpp.js.
