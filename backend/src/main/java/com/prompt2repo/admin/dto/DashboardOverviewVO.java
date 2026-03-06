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
public class DashboardOverviewVO {

    private Long userCount;
    private Long menuCount;
    private Long onlineSessions;
    private LocalDateTime serverTime;
}
