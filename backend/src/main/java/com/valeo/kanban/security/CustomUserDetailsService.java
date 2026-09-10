package com.valeo.kanban.security;

import com.valeo.kanban.model.entity.User;
import com.valeo.kanban.repository.UserRepository;
import lombok.RequiredArgsConstructor;
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

    private static final List<GrantedAuthority> ADMIN_AUTHORITIES = List.of(new SimpleGrantedAuthority("ROLE_ADMIN"));
    private static final List<GrantedAuthority> USER_AUTHORITIES = List.of(new SimpleGrantedAuthority("ROLE_VIEWER"));

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
        return user.isAdmin() ? ADMIN_AUTHORITIES : USER_AUTHORITIES;
    }
}
