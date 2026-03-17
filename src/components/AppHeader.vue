<script setup>
const logoSrc = `${import.meta.env.BASE_URL}image/noaa_logo_circle_72x72.svg`
</script>

<template>
  <nav class="navbar navbar-expand-lg navbar-dark fixed-top custom-navbar">
    <div class="container">
      <a class="navbar-brand d-flex align-items-center" href="../index.html">
        <img :src="logoSrc" alt="NOAA" height="50" class="me-2" />
        NOAA PolarWatch
      </a>

      <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
        <span class="navbar-toggler-icon"></span>
      </button>

      <div class="collapse navbar-collapse justify-content-end" id="navbarNav">
        <ul class="navbar-nav">
          <li class="nav-item"><a class="nav-link" href="#about">About PolarWatch</a></li>
          <li class="nav-item"><a class="nav-link" href="#search">Data Catalog</a></li>
        </ul>
      </div>
    </div>
  </nav>
</template>