package com.prompt2repo.admin.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LoginAttemptStatusVO {

    private int remainingAttempts;

    private boolean locked;

    private long lockTtlSeconds;
}
