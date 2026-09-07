package com.valeo.kanban.repository;

import com.valeo.kanban.dto.response.WorkspaceCountProjection;
import com.valeo.kanban.model.entity.WorkspaceMember;
import com.valeo.kanban.model.enums.WorkspaceRole;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface WorkspaceMemberRepository extends JpaRepository<WorkspaceMember, Long> {
    Optional<WorkspaceMember> findByWorkspaceIdAndUserId(Long workspaceId, Long userId);
    List<WorkspaceMember> findAllByWorkspaceId(Long workspaceId);
    List<WorkspaceMember> findAllByUserId(Long userId);
    long countByWorkspaceId(Long workspaceId);
    boolean existsByWorkspaceIdAndUserId(Long workspaceId, Long userId);

    @Query("SELECT m FROM WorkspaceMember m JOIN FETCH m.workspace WHERE m.user.id = :userId")
    List<WorkspaceMember> findAllByUserIdWithWorkspace(@Param("userId") Long userId);

    @Query("SELECT m.workspace.id AS workspaceId, COUNT(m) AS count " +
           "FROM WorkspaceMember m " +
           "WHERE m.workspace.id IN :workspaceIds " +
           "GROUP BY m.workspace.id")
    List<WorkspaceCountProjection> countByWorkspaceIds(@Param("workspaceIds") List<Long> workspaceIds);

    @Query("SELECT m FROM WorkspaceMember m JOIN FETCH m.user WHERE m.workspace.id = :workspaceId")
    List<WorkspaceMember> findAllByWorkspaceIdWithUser(@Param("workspaceId") Long workspaceId);
}
