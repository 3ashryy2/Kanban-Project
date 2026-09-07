package com.valeo.kanban.security;

import com.valeo.kanban.model.entity.User;
import com.valeo.kanban.repository.UserRepository;
import com.valeo.kanban.repository.WorkspaceMemberRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class CustomUserDetailsService implements UserDetailsService {

    private final UserRepository userRepository;
    private final WorkspaceMemberRepository workspaceMemberRepository;

    @Value("${app.security.platform-admins:admin@valeo.com}")
    private List<String> platformAdmins;

    @Override
    @Transactional(readOnly = true)
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException("User not found with email: " + email));
        return CustomUserDetails.create(user, buildAuthorities(user));
    }

    @Transactional(readOnly = true)
    public UserDetails loadUserById(Long id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new UsernameNotFoundException("User not found with ID: " + id));
        return CustomUserDetails.create(user, buildAuthorities(user));
    }

    private List<GrantedAuthority> buildAuthorities(User user) {
        List<GrantedAuthority> authorities = new ArrayList<>();
        authorities.add(new SimpleGrantedAuthority("ROLE_VIEWER"));

        // Platform Administration Override
        if (platformAdmins != null && platformAdmins.contains(user.getEmail().toLowerCase())) {
            if (authorities.stream().noneMatch(a -> a.getAuthority().equals("ROLE_ADMIN"))) {
                authorities.add(new SimpleGrantedAuthority("ROLE_ADMIN"));
            }
        }

        return authorities;
    }
}
