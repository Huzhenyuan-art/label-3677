package com.prompt2repo.admin.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OnlineSessionVO {

    private Long userId;

    private String username;

    private String nickname;

    private String sessionId;

    private String loginIp;

    private LocalDateTime loginAt;

    private LocalDateTime expireAt;
}
