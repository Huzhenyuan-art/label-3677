package com.prompt2repo.admin.util;

import com.prompt2repo.admin.exception.BusinessException;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jws;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.annotation.PostConstruct;
import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Date;
import java.util.UUID;

@Component
public class JwtTokenService {

    @Value("${app.jwt-secret}")
    private String jwtSecret;

    @Value("${app.token-expire-minutes}")
    private long tokenExpireMinutes;

    private SecretKey secretKey;

    @PostConstruct
    public void init() {
        String normalizedSecret = jwtSecret;
        if (jwtSecret.length() < 32) {
            normalizedSecret = (jwtSecret + "_prompt2repo_secure_key_2026");
        }
        this.secretKey = Keys.hmacShaKeyFor(normalizedSecret.getBytes(StandardCharsets.UTF_8));
    }

    public String generateToken(Long userId, String username) {
        return generateToken(userId, username, UUID.randomUUID().toString());
    }

    public String generateToken(Long userId, String username, String sessionId) {
        Instant now = Instant.now();
        Instant expireAt = now.plusSeconds(getExpireSeconds());
        return Jwts.builder()
                .setSubject(String.valueOf(userId))
                .claim("username", username)
                .claim("sessionId", sessionId)
                .setIssuedAt(Date.from(now))
                .setExpiration(Date.from(expireAt))
                .signWith(secretKey, SignatureAlgorithm.HS256)
                .compact();
    }

    public String parseSessionId(String token) {
        return parseClaims(token).get("sessionId", String.class);
    }

    public Long parseUserId(String token) {
        Claims claims = parseClaims(token);
        return Long.parseLong(claims.getSubject());
    }

    public String parseUsername(String token) {
        return parseClaims(token).get("username", String.class);
    }

    public LocalDateTime parseExpireAt(String token) {
        Date expiration = parseClaims(token).getExpiration();
        return LocalDateTime.ofInstant(expiration.toInstant(), ZoneId.of("Asia/Shanghai"));
    }

    public long getExpireSeconds() {
        return tokenExpireMinutes * 60;
    }

    private Claims parseClaims(String token) {
        try {
            Jws<Claims> claimsJws = Jwts.parserBuilder()
                    .setSigningKey(secretKey)
                    .build()
                    .parseClaimsJws(token);
            return claimsJws.getBody();
        } catch (JwtException | IllegalArgumentException ex) {
            throw new BusinessException(401, "令牌无效或已过期");
        }
    }
}
