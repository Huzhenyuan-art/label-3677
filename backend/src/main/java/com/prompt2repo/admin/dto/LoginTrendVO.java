package com.prompt2repo.admin.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LoginTrendVO {

    private String date;
    private Long successCount;
    private Long failCount;
}
