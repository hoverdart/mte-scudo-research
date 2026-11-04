FROM ubuntu:24.04@sha256:fe81560990fae86dc4743202b2cb4d3df98d0bcf949173cecef15ce1127ef852
RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends clang-18 libclang-rt-18-dev binutils ca-certificates && rm -rf /var/lib/apt/lists/*
USER 65532:65532
WORKDIR /tmp
