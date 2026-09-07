package com.valeo.kanban.repository;

import com.valeo.kanban.model.entity.AuditLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {

    Page<AuditLog> findByWorkspaceIdOrderByTimestampDesc(Long workspaceId, Pageable pageable);

    Page<AuditLog> findByWorkspaceIdAndActionTypeOrderByTimestampDesc(Long workspaceId, String actionType, Pageable pageable);

    Page<AuditLog> findByActionTypeOrderByTimestampDesc(String actionType, Pageable pageable);

    Page<AuditLog> findAllByOrderByTimestampDesc(Pageable pageable);

    Page<AuditLog> findByBoardIdOrderByTimestampDesc(Long boardId, Pageable pageable);

    Page<AuditLog> findByTaskIdOrderByTimestampDesc(Long taskId, Pageable pageable);
}
