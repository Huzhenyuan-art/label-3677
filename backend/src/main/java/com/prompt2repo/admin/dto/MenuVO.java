package com.prompt2repo.admin.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MenuVO {

    private Long id;
    private Long parentId;
    private String title;
    private String path;
    private String icon;
    private String permCode;
    private Integer sortOrder;
    private Integer visible;

    @Builder.Default
    private List<MenuVO> children = new ArrayList<>();

    public List<MenuVO> getChildren() {
        if (children == null) {
            children = new ArrayList<>();
        }
        return children;
    }
}
