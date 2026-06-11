package com.prompt2repo.admin.config;

import org.springframework.boot.test.context.TestConfiguration;
import redis.embedded.RedisServer;
import javax.annotation.PostConstruct;
import javax.annotation.PreDestroy;
import java.io.IOException;
import java.net.Socket;

@TestConfiguration
public class EmbeddedRedisConfig {

    private RedisServer redisServer;
    private int redisPort = 6379;
    private boolean useEmbedded = false;

    @PostConstruct
    public void startRedis() throws IOException {
        if (!isPortAvailable(redisPort)) {
            System.out.println("Redis is already running on port " + redisPort + ", using existing instance.");
            return;
        }
        try {
            redisServer = RedisServer.builder()
                    .port(redisPort)
                    .setting("maxheap 128M")
                    .build();
            redisServer.start();
            useEmbedded = true;
            System.out.println("Embedded Redis started on port " + redisPort);
        } catch (Exception e) {
            System.err.println("Failed to start embedded Redis on port " + redisPort + ": " + e.getMessage());
            System.err.println("Please make sure Redis is running on port 6379 or install Redis.");
        }
    }

    @PreDestroy
    public void stopRedis() {
        if (useEmbedded && redisServer != null && redisServer.isActive()) {
            redisServer.stop();
            System.out.println("Embedded Redis stopped.");
        }
    }

    private boolean isPortAvailable(int port) {
        try (Socket socket = new Socket("localhost", port)) {
            return false;
        } catch (IOException e) {
            return true;
        }
    }

    public int getRedisPort() {
        return redisPort;
    }
}
