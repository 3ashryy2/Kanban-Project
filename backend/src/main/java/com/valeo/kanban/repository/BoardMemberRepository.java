package com.valeo.kanban.repository;

import com.valeo.kanban.model.entity.BoardMember;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.Collection;
import java.util.List;
import java.util.Set;

@Repository
public interface BoardMemberRepository extends JpaRepository<BoardMember, Long> {

    boolean existsByBoardIdAndUserId(Long boardId, Long userId);

    @Query("SELECT bm.board.id FROM BoardMember bm WHERE bm.workspaceId = :workspaceId AND bm.user.id = :userId")
    Set<Long> findBoardIdsByWorkspaceIdAndUserId(@Param("workspaceId") Long workspaceId, @Param("userId") Long userId);

    // One query for a whole workspace roster (avoids a board lookup per member)
    @Query("SELECT bm FROM BoardMember bm JOIN FETCH bm.board WHERE bm.workspaceId = :workspaceId")
    List<BoardMember> findAllByWorkspaceIdWithBoard(@Param("workspaceId") Long workspaceId);

    @Query("SELECT bm FROM BoardMember bm JOIN FETCH bm.user WHERE bm.board.id = :boardId")
    List<BoardMember> findAllByBoardIdWithUser(@Param("boardId") Long boardId);

    @Modifying
    @Query("DELETE FROM BoardMember bm WHERE bm.user.id = :userId AND bm.board.id IN :boardIds")
    int deleteByUserIdAndBoardIdIn(@Param("userId") Long userId, @Param("boardIds") Collection<Long> boardIds);
}
