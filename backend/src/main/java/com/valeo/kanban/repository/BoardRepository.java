package com.valeo.kanban.repository;

import com.valeo.kanban.model.entity.Board;
import com.valeo.kanban.dto.response.WorkspaceCountProjection;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface BoardRepository extends JpaRepository<Board, Long> {

    @Query("SELECT b FROM Board b LEFT JOIN FETCH b.columns c WHERE b.id = :boardId")
    Optional<Board> findBoardWithColumnsById(@Param("boardId") Long boardId);

    List<Board> findAllByWorkspaceId(Long workspaceId);

    long countByWorkspaceId(Long workspaceId);

    @Query("SELECT b.workspace.id AS workspaceId, COUNT(b) AS count " +
           "FROM Board b " +
           "WHERE b.workspace.id IN :workspaceIds " +
           "GROUP BY b.workspace.id")
    List<WorkspaceCountProjection> countByWorkspaceIds(@Param("workspaceIds") List<Long> workspaceIds);
}
