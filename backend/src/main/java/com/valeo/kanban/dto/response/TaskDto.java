package com.valeo.kanban.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.Instant;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TaskDto {
    private Long id;
    private Long boardId;
    private Long columnId;
    private String title;
    private String description;
    private String priority;
    private String status;
    private double position;
    private SimpleUserDto assignee;
    private SimpleUserDto createdBy;
    private Instant dueDate;
    private List<String> tags;
    private String rejectionReason;
    private Long version;
    private Instant createdAt;
    private Instant updatedAt;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class SimpleUserDto {
        private Long id;
        private String email;
        private String firstName;
        private String lastName;
    }
}
